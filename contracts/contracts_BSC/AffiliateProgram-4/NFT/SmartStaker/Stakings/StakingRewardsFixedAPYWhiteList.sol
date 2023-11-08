// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IStakingRewards {
    function earned(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function stake(uint256 amount) external;
    function getReward() external;
    function getRewardForUser(address user) external;
    function withdraw(uint256 nonce) external;
    function withdrawAndGetReward(uint256 nonce) external;
}

interface IPriceFeed {
    function queryRate(address sourceTokenAddress, address destTokenAddress) external view returns (uint256 rate, uint256 precision);
    function wbnbToken() external view returns(address);
}

contract StakingRewardsFixedAPY is IStakingRewards, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardsToken;
    IERC20 public immutable stakingToken;
    INimbusRouter public swapRouter;
    uint256 public rewardRate; 
    uint256 public constant rewardDuration = 365 days; 
    uint256 public rateChangesNonce;

    mapping(address => uint256) public weightedStakeDate;
    mapping(address => mapping(uint256 => StakeNonceInfo)) public stakeNonceInfos;
    mapping(address => uint256) public stakeNonces;
    mapping(uint256 => APYCheckpoint) APYcheckpoints;

    struct StakeNonceInfo {
        uint256 stakeTime;
        uint256 stakingTokenAmount;
        uint256 rewardsTokenAmount;
        uint256 rewardRate;
    }

    struct APYCheckpoint {
        uint256 timestamp;
        uint256 rewardRate;
    }

    uint256 private _totalSupply;
    uint256 private _totalSupplyRewardEquivalent;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _balancesRewardEquivalent;
    mapping(address => bool) private _isStakerAllowed;

    bool public usePriceFeeds;
    IPriceFeed public priceFeed;

    event RewardRateUpdated(uint256 indexed rateChangesNonce, uint256 rewardRate, uint256 timestamp);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed to, address indexed token, uint amount);

    event ToggleUsePriceFeeds(bool indexed usePriceFeeds);

    constructor(
        address _rewardsToken,
        address _stakingToken,
        address _swapRouter,
        uint _rewardRate
    ) {
        require(_rewardsToken != address(0) && _swapRouter != address(0), "StakingRewardFixedAPY: Zero address(es)");
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        swapRouter = INimbusRouter(_swapRouter);
        rewardRate = _rewardRate;
        emit RewardRateUpdated(rateChangesNonce, _rewardRate, block.timestamp);
        APYcheckpoints[rateChangesNonce++] = APYCheckpoint(block.timestamp, rewardRate);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function totalSupplyRewardEquivalent() external view returns (uint256) {
        return _totalSupplyRewardEquivalent;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    function balanceOfRewardEquivalent(address account) external view returns (uint256) {
        return _balancesRewardEquivalent[account];
    }

    function earnedByNonce(address account, uint256 nonce) public view returns (uint256) {
        return stakeNonceInfos[account][nonce].rewardsTokenAmount * 
            (block.timestamp - stakeNonceInfos[account][nonce].stakeTime) *
             stakeNonceInfos[account][nonce].rewardRate / (100 * rewardDuration);
    }

    function earned(address account) public view override returns (uint256 totalEarned) {
        for (uint256 i = 0; i < stakeNonces[account]; i++) {
            totalEarned += earnedByNonce(account, i);
        }
    }

    function stake(uint256 amount) external override nonReentrant {
        require(amount > 0, "StakingRewardFixedAPY: Cannot stake 0");
        _stake(amount, msg.sender);
    }

    function _stake(uint256 amount, address user) private whenNotPaused {
        require(isStakerAllowed(msg.sender), "StakingRewardFixedAPY: Not allowed to stake");
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        uint amountRewardEquivalent = getEquivalentAmount(amount);

        _totalSupply += amount;
        _totalSupplyRewardEquivalent += amountRewardEquivalent;
        _balances[user] += amount;

        uint stakeNonce = stakeNonces[user]++;
        stakeNonceInfos[user][stakeNonce].stakingTokenAmount = amount;
        stakeNonceInfos[user][stakeNonce].stakeTime = block.timestamp;
        stakeNonceInfos[user][stakeNonce].rewardRate = rewardRate;
        stakeNonceInfos[user][stakeNonce].rewardsTokenAmount = amountRewardEquivalent;
        _balancesRewardEquivalent[user] += amountRewardEquivalent;
        emit Staked(user, amount);
    }



    //A user can withdraw its staking tokens even if there is no rewards tokens on the contract account
    function withdraw(uint256 nonce) public override nonReentrant whenNotPaused {
        require(stakeNonceInfos[msg.sender][nonce].stakingTokenAmount > 0, "StakingRewardFixedAPY: This stake nonce was withdrawn");
        uint amount = stakeNonceInfos[msg.sender][nonce].stakingTokenAmount;
        uint amountRewardEquivalent = stakeNonceInfos[msg.sender][nonce].rewardsTokenAmount;
        _totalSupply -= amount;
        _totalSupplyRewardEquivalent -= amountRewardEquivalent;
        _balances[msg.sender] -= amount;
        _balancesRewardEquivalent[msg.sender] -= amountRewardEquivalent;
        stakeNonceInfos[msg.sender][nonce].stakingTokenAmount = 0;
        stakeNonceInfos[msg.sender][nonce].rewardsTokenAmount = 0;
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant whenNotPaused {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            for (uint256 i = 0; i < stakeNonces[msg.sender]; i++) {
                stakeNonceInfos[msg.sender][i].stakeTime = block.timestamp;
            }
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function getRewardForUser(address user) public override nonReentrant whenNotPaused {
        require(msg.sender == owner(), "StakingRewardFixedAPY :: isn`t allowed to call rewards");
        uint256 reward = earned(user);
        if (reward > 0) {
            for (uint256 i = 0; i < stakeNonces[user]; i++) {
                stakeNonceInfos[user][i].stakeTime = block.timestamp;
            }
            rewardsToken.safeTransfer(user, reward);
            emit RewardPaid(user, reward);
        }
    }

    function withdrawAndGetReward(uint256 nonce) external override {
        getReward();
        withdraw(nonce);
    }

    function getEquivalentAmount(uint amount) public view returns (uint) {
        address[] memory path = new address[](2);

        uint equivalent;
        if (stakingToken != rewardsToken) {
             if (usePriceFeeds && address(priceFeed) != address(0)) {
                (uint256 rate, uint256 precision) = priceFeed.queryRate(address(stakingToken), address(rewardsToken));
                equivalent = amount * rate / precision;
            } else {
                path[0] = address(stakingToken);            
                path[1] = address(rewardsToken);
                equivalent = swapRouter.getAmountsOut(amount, path)[1];
            }
        } else {
            equivalent = amount;   
        }
        
        return equivalent;
    }

    function isStakerAllowed(address staker) public view returns (bool) {
        return _isStakerAllowed[staker];
    }

    // allowance for particular Staking Sets    
    function updateAllowedStaker(address staker, bool isAllowed) external onlyOwner {
        _isStakerAllowed[staker] = isAllowed;
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    function updateRewardRate(uint256 _rewardRate) external onlyOwner {
        rewardRate = _rewardRate;
        emit RewardRateUpdated(rateChangesNonce, _rewardRate, block.timestamp);
        APYcheckpoints[rateChangesNonce++] = APYCheckpoint(block.timestamp, _rewardRate);
    }

    function updateSwapRouter(address newSwapRouter) external onlyOwner {
        require(newSwapRouter != address(0), "StakingRewardFixedAPY: Address is zero");
        swapRouter = INimbusRouter(newSwapRouter);
    }

    function updatePriceFeed(address newPriceFeed) external onlyOwner {
        require(newPriceFeed != address(0), "StakingRewardFixedAPY: Address is zero");
        priceFeed = IPriceFeed(newPriceFeed);
    }

    function toggleUsePriceFeeds() external onlyOwner {
        usePriceFeeds = !usePriceFeeds;
        emit ToggleUsePriceFeeds(usePriceFeeds);
    }

    function rescue(address to, address token, uint256 amount) external onlyOwner whenPaused {
        require(to != address(0), "StakingRewardFixedAPY: Cannot rescue to the zero address");
        require(amount > 0, "StakingRewardFixedAPY: Cannot rescue 0");
        //owner can rescue rewardsToken if there is spare unused tokens on staking contract balance

        IERC20(token).safeTransfer(to, amount);
        emit RescueToken(to, address(token), amount);
    }

    function rescue(address payable to, uint256 amount) external onlyOwner whenPaused {
        require(to != address(0), "StakingRewardFixedAPY: Cannot rescue to the zero address");
        require(amount > 0, "StakingRewardFixedAPY: Cannot rescue 0");

        to.transfer(amount);
        emit Rescue(to, amount);
    }
}
