// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

interface ILockStakingRewardFixedAPY {
    struct StakeNonceInfo {
        uint256 unlockTime;
        uint256 stakeTime;
        uint256 stakingTokenAmount;
        uint256 rewardsTokenAmount;
        uint256 rewardRate;
    }

    function getTokenAmountForToken(
        address tokenSrc,
        address tokenDest,
        uint256 tokenAmount
    ) external view returns (uint256);

    function stakeNonceInfos(address user, uint256 nonce)
        external
        view
        returns (StakeNonceInfo memory);

    function stakeNonces(address user) external view returns (uint256);

    function rewardsToken() external view returns (IERC20Upgradeable);

    function rewardDuration() external view returns (uint256);

    function usePriceFeeds() external view returns (bool);

    function getRewardForUser(address user) external;

    function earned(address account) external view returns (uint256);

    function earnedByNonce(address account, uint256 nonce) external view returns (uint256);
}

interface NimbusInitialAcquisition {
    function stakingPools(uint stakingId) external view returns (ILockStakingRewardFixedAPY);
}

/**
 * @title StakingRewardsPayment
 * @notice This contract is used to pay rewards for staking with custom rules
 */
contract StakingRewardsPayment is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(address => mapping(address => mapping(uint256 => uint256))) public stakeTime;
    mapping(address => bool) public allowedStakings;

    address public affiliateContract;
    mapping(bytes32 => uint256) private rewardsReducerFactor;

    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed to, address indexed token, uint amount);
    IERC20Upgradeable public newRewardsToken;

    /*
    * @dev Checks if the provided address is a allowed staking
    * @param stakingPool address of the staking
    */
    modifier onlyAllowedStakings(ILockStakingRewardFixedAPY stakingPool) {
        require(
            allowedStakings[address(stakingPool)],
            "Provided address is not a allowed"
        );
        _;
    }

    function initialize() public initializer {
        __Ownable_init_unchained();
        __Pausable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @dev calculate earned rewards for user by single nonces
     * @param account address of user
     * @param nonce nonce of stake
     * @param stakingPool address of staking pool
     * @return totalEarned total earned rewards
     */
    function earnedByNonce(
        address account,
        uint256 nonce,
        ILockStakingRewardFixedAPY stakingPool
    ) public view returns (uint256) {
        if (!allowedStakings[address(stakingPool)]) return stakingPool.earnedByNonce(account, nonce);
        ILockStakingRewardFixedAPY.StakeNonceInfo
            memory stakeInfo = stakingPool.stakeNonceInfos(account, nonce);
        if (stakeInfo.stakingTokenAmount == 0 || stakeInfo.stakeTime > stakeInfo.unlockTime) return 0;
        return (stakeInfo.rewardsTokenAmount *
                (((block.timestamp > stakeInfo.unlockTime) ? stakeInfo.unlockTime : block.timestamp) - 
                ((stakeTime[address(stakingPool)][account][nonce] == 0) ? stakeInfo.stakeTime : stakeTime[address(stakingPool)][account][nonce])) *
                stakeInfo.rewardRate) / (100 * 365 days);
    }

    /**
     * @dev calculate earned rewards for user by multiple nonces
     * @param account address of user
     * @param nonces array of nonces
     * @param stakingPool address of staking pool
     * @return totalEarned total earned rewards
     */
    function earnedByNonceBatch(
        address account,
        uint256[] memory nonces,
        ILockStakingRewardFixedAPY stakingPool
    ) public view returns (uint256 totalEarned) {
        for (uint256 i = 0; i < nonces.length; ) {
            totalEarned += earnedByNonce(account, nonces[i], stakingPool);
            unchecked { ++i; }
        }
    }

    /**
     * @dev calculate earned rewards for user
     * @param account address of user
     * @param stakingPool address of staking pool
     * @return totalEarned total earned rewards
     */
    function earned(address account, ILockStakingRewardFixedAPY stakingPool)
        public
        view
        returns (uint256 totalEarned)
    {
        for (uint256 i = 0; i < stakingPool.stakeNonces(account); ) {
            totalEarned += earnedByNonce(account, i, stakingPool);
            unchecked { ++i; }
        }
    }

    /**
     * @dev withdraw staking rewards for caller by nonce
     * @param stakingPool address of staking pool
     * @param nonce nonce of stake
     */
    function getRewardByNonce(ILockStakingRewardFixedAPY stakingPool, uint256 nonce)
        public
        nonReentrant
        whenNotPaused
        onlyAllowedStakings(stakingPool)
    {
        address account = msg.sender;
        require(nonce < stakingPool.stakeNonces(account), "Invalid nonce");
        uint256 reward = _processRewardByNonceForUser(account, stakingPool, nonce);
        newRewardsToken.safeTransfer(account, reward);
    }

    /**
     * @dev withdraw staking rewards for caller by nonce
     * @param stakingPool address of staking pool
     */
    function getReward(ILockStakingRewardFixedAPY stakingPool)
        public
        nonReentrant
        whenNotPaused
        onlyAllowedStakings(stakingPool)
    {
        _getReward(msg.sender, stakingPool);
    }

    /**
     * @dev withdraw staking rewards for user, can be called only by affiliate contract or owner
     * @param user address of user
     * @param stakingPool address of staking pool
     */
    function getRewardForUser(
        address user,
        ILockStakingRewardFixedAPY stakingPool
    ) public nonReentrant whenNotPaused onlyAllowedStakings(stakingPool) {
        require(
            msg.sender == affiliateContract || msg.sender == owner(),
            "StakingRewardsPayment :: isn`t allowed to call rewards"
        );
        _getReward(user, stakingPool);
    }

    /**
     * @dev get staking rewards from multiple contracts at once
     * @param stakingIds array of staking ids from affiliate contract
     */
    function getAllStakingRewards(uint256[] memory stakingIds) nonReentrant whenNotPaused public {
        require(stakingIds.length > 0, "No staking IDs");
        address user = msg.sender;
        for (uint256 index = 0; index < stakingIds.length; ) {
            ILockStakingRewardFixedAPY stakingPool = NimbusInitialAcquisition(affiliateContract).stakingPools(stakingIds[index]);
            if (address(stakingPool) != address(0)) {
                if (allowedStakings[address(stakingPool)]) {
                    _getReward(user, stakingPool);
                }
                else stakingPool.getRewardForUser(user);
            }
            unchecked { ++index; }
        }
    }

    /**
     * @dev update allowed staking
     * @param staking address of the staking
     * @param isActive is staking active
     */
    function updateAllowedStakings(address staking, bool isActive)
        external
        onlyOwner
    {
        require(staking != address(0), "staking address is equal to 0");
        allowedStakings[staking] = isActive;
    }

    /**
     * @dev set affiliate contract
     * @param _affiliateContract address of the affiliate contract
     */
    function setAffiliateContract(address _affiliateContract)
        external
        onlyOwner
    {
        require(
            _affiliateContract != address(0),
            "StakingRewardsPayment: Zero address"
        );
        affiliateContract = _affiliateContract;
    }

    /**
     * @dev withdraw rewards from the contract for user and update stakeTime
     * @param account address of the user
     * @param stakingPool address of the staking
     */
    function _getReward(
        address account,
        ILockStakingRewardFixedAPY stakingPool
    ) private {
        uint256 reward;
        for (uint256 i = 0; i < stakingPool.stakeNonces(account); ) {
            reward += _processRewardByNonceForUser(account, stakingPool, i);
            unchecked { ++i; }
        }
        newRewardsToken.safeTransfer(account, reward);
    }

    /**
     * Calculate rewards for user by nonce and update stakeTime
     * @param account address of the user
     * @param stakingPool address of the staking
     * @param nonce nonce of stake
     */
    function _processRewardByNonceForUser(address account, ILockStakingRewardFixedAPY stakingPool, uint256 nonce) internal returns (uint256) {
    uint256 reward;
    ILockStakingRewardFixedAPY.StakeNonceInfo memory stakeInfo = stakingPool.stakeNonceInfos(account, nonce);

    bytes32 key = keccak256(abi.encodePacked(address(stakingPool), account, nonce));
    uint256 reducedRewardAmount = rewardsReducerFactor[key];

    if (reducedRewardAmount > 0) {
        uint256 timeDiff;
        if (block.timestamp > stakeInfo.unlockTime) {
            timeDiff = stakeInfo.unlockTime;
        } else {
            timeDiff = block.timestamp;
        }

        uint256 stakeTimeValue = stakeTime[address(stakingPool)][account][nonce];
        if (stakeTimeValue == 0) {
            stakeTimeValue = stakeInfo.stakeTime;
        }

        reward = (stakeInfo.rewardsTokenAmount * (timeDiff - stakeTimeValue) * stakeInfo.rewardRate) / (100 * 365 days) / reducedRewardAmount;
    } else {
        if (stakeInfo.stakingTokenAmount == 0 || stakeInfo.stakeTime > stakeInfo.unlockTime) {
            reward = 0;
        } else {
            uint256 timeDiff;
            if (block.timestamp > stakeInfo.unlockTime) {
                timeDiff = stakeInfo.unlockTime;
            } else {
                timeDiff = block.timestamp;
            }

            uint256 stakeTimeValue = stakeTime[address(stakingPool)][account][nonce];
            if (stakeTimeValue == 0) {
                stakeTimeValue = stakeInfo.stakeTime;
            }

            reward = (stakeInfo.rewardsTokenAmount * (timeDiff - stakeTimeValue) * stakeInfo.rewardRate) / (100 * 365 days);
        }
    }

    if (reward > 0) {
        if (block.timestamp > stakeInfo.unlockTime) {
            stakeTime[address(stakingPool)][account][nonce] = stakeInfo.unlockTime;
        } else {
            stakeTime[address(stakingPool)][account][nonce] = block.timestamp;
        }
    }

    return reward;
}

    /**
     * @dev Change the paused state of the contract
     * @param _paused new paused state
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
     * @dev Rescue tokens from the contract
     * @param to address to send tokens to
     * @param amount amount of tokens to send
     * @param token address of the token to send
     */
    function rescueERC20(address to, IERC20Upgradeable token, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot rescue to the zero address");
        require(amount > 0, "Cannot rescue 0");

        token.safeTransfer(to, amount);
        emit RescueToken(to, address(token), amount);
    }

    function addReducerRewardFactor(address account, uint256 nonce, uint256 amount, ILockStakingRewardFixedAPY stakingPool) external onlyOwner {
        require(amount > 0, "Amount needs to be more than 0");
        bytes32 key = keccak256(abi.encodePacked(address(stakingPool), account, nonce));
        rewardsReducerFactor[key] = amount;
    }

    function earnedByNonceWithReducedReward(address account, uint256 nonce, ILockStakingRewardFixedAPY stakingPool) public view returns (uint256) {
        uint256 originalEarned = earnedByNonce(account, nonce, stakingPool);
        bytes32 key = keccak256(abi.encodePacked(address(stakingPool), account, nonce));
        uint256 reducedRewardAmount = rewardsReducerFactor[key];

        if (reducedRewardAmount > 0) {
            return originalEarned / reducedRewardAmount;
        } else {
            return originalEarned;
        }
    }

    function setNewRewardsToken(IERC20Upgradeable _newRewardsToken) external onlyOwner {
            require(address(_newRewardsToken) != address(0), "New rewards token is the zero address");
            newRewardsToken = _newRewardsToken;

    }

}
