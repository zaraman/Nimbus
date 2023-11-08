pragma solidity =0.8.0;

interface IBEP20 {
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function getOwner() external view returns (address);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Ownable {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed from, address indexed to);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Ownable: Caller is not the owner");
        _;
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    function transferOwnership(address transferOwner) external onlyOwner {
        require(transferOwner != newOwner);
        newOwner = transferOwner;
    }

    function acceptOwnership() virtual external {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

abstract contract Pausable is Ownable {
    event Paused(address account);
    event Unpaused(address account);

    bool private _paused;

    constructor () {
        _paused = false;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }


    function pause() external onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

interface INimbusVesting {
    function vest(address user, uint amount, uint vestingFirstPeriod, uint vestingSecondPeriod) external;
    function vestWithVestType(address user, uint amount, uint vestingFirstPeriodDuration, uint vestingSecondPeriodDuration, uint vestType) external;
    function unvest() external returns (uint unvested);
    function unvestFor(address user) external returns (uint unvested);
}

interface INimbusReferralProgram {
    function userSponsorByAddress(address user)  external view returns (uint);
    function userIdByAddress(address user) external view returns (uint);
    function userAddressById(uint id) external view returns (address);
    function userSponsorAddressByAddress(address user) external view returns (address);
    function registerUserBySponsorId(address user, uint sponsorId, uint category) external returns (uint);
    function registerUserBySponsorAddress(address user, address sponsorAddress, uint category) external returns (uint); 
}

interface INimbusStakingPool {
    function stakeFor(uint amount, address user) external;
    function balanceOf(address account) external view returns (uint256);
    function stakingToken() external view returns (IBEP20);
}

interface INBU_WBNB {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}

library Address {
    function isContract(address account) internal view returns (bool) {
        // This method relies in extcodesize, which returns 0 for contracts in construction, 
        // since the code is only stored at the end of the constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }
}

contract NimbusInitialAcquisition is Ownable, Pausable {
    uint public constant USER_CATEGORY = 3;
    IBEP20 public immutable SYSTEM_TOKEN;
    address public immutable NBU_WBNB;
    INimbusReferralProgram public referralProgram;
    INimbusStakingPool[] public stakingPoolsSponsor;   //staking pools for checking sponsor balances

    INimbusVesting public vestingContract;
    uint public vestingFirstPeriodDuration;
    uint public vestingSecondPeriodDuration;

    mapping(uint => INimbusStakingPool) public stakingPools;

    address public recipient;                      
   
    INimbusRouter public swapRouter;                
    mapping (address => bool) public allowedTokens;
    address public swapToken;                       
    uint public swapTokenAmountForBonusThreshold;  
    
    uint public sponsorBonus;
    mapping(address => uint) public unclaimedBonusBases;

    bool public useWeightedRates;
    mapping(address => uint) public weightedTokenSystemTokenExchangeRates;

    uint public giveBonus;

    event BuySystemTokenForToken(address indexed token, uint tokenAmount, uint systemTokenAmount, address indexed systemTokenRecipient);
    event BuySystemTokenForBnb(uint bnbAmount, uint systemTokenAmount, address indexed systemTokenRecipient);
    event ProcessSponsorBonus(address indexed sponsor, address indexed user, uint bonusAmount, uint indexed timestamp);
    event AddUnclaimedSponsorBonus(address indexed user, uint systemTokenAmount);

    event UpdateTokenSystemTokenWeightedExchangeRate(address indexed token, uint indexed newRate);
    event ToggleUseWeightedRates(bool indexed useWeightedRates);
    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed token, address indexed to, uint amount);

    event AllowedTokenUpdated(address indexed token, bool allowance);
    event SwapTokenUpdated(address indexed swapToken);
    event SwapTokenAmountForBonusThresholdUpdated(uint indexed amount);

    event ProcessGiveBonus(address indexed to, uint amount, uint indexed timestamp);
    event UpdateGiveBonus(uint indexed giveBonus);
    event UpdateVestingContract(address indexed vestingContractAddress);
    event UpdateVestingParams(uint vestingFirstPeriod, uint vestingSecondPeriod);

    constructor (address systemToken, address vestingContractAddress, address router, address nbuWbnb) {
        require(Address.isContract(systemToken), "systemToken is not a contract");
        require(Address.isContract(vestingContractAddress), "vestingContractAddress is not a contract");
        require(Address.isContract(router), "router is not a contract");
        require(Address.isContract(nbuWbnb), "nbuWbnb is not a contract");
        SYSTEM_TOKEN = IBEP20(systemToken);
        vestingContract = INimbusVesting(vestingContractAddress);
        NBU_WBNB = nbuWbnb;
        sponsorBonus = 10;
        giveBonus = 12;
        swapRouter = INimbusRouter(router);
        recipient = address(this);
        vestingFirstPeriodDuration = 60 days;
        vestingSecondPeriodDuration = 0;
    }

    function availableInitialSupply() external view returns (uint) {
        return SYSTEM_TOKEN.balanceOf(address(this));
    }

    function getSystemTokenAmountForToken(address token, uint tokenAmount) public view returns (uint) { 
        if (!useWeightedRates) {
            address[] memory path = new address[](2);
            path[0] = token;
            path[1] = address(SYSTEM_TOKEN);
            return swapRouter.getAmountsOut(tokenAmount, path)[1];
        } else {
            return tokenAmount * weightedTokenSystemTokenExchangeRates[token] / 1e18;
        }  
    }

    function getSystemTokenAmountForBnb(uint bnbAmount) public view returns (uint) { 
        return getSystemTokenAmountForToken(NBU_WBNB, bnbAmount); 
    }

    function getTokenAmountForSystemToken(address token, uint systemTokenAmount) public view returns (uint) { 
        if (!useWeightedRates) { 
            address[] memory path = new address[](2);
            path[0] = token;
            path[1] = address(SYSTEM_TOKEN);
            return swapRouter.getAmountsIn(systemTokenAmount, path)[0];
        } else {
            return systemTokenAmount * 1e18 / weightedTokenSystemTokenExchangeRates[token];
        }
    }

    function getBnbAmountForSystemToken(uint systemTokenAmount) public view returns (uint) { 
        return getTokenAmountForSystemToken(NBU_WBNB, systemTokenAmount);
    }

    function currentBalance(address token) external view returns (uint) { 
        return IBEP20(token).balanceOf(address(this));
    }

    function _buySystemToken(address token, uint tokenAmount, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) private {
        stakingPools[stakingPoolId].stakeFor(systemTokenAmount, systemTokenRecipient);
        
        emit BuySystemTokenForToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient);
        if (giveBonus > 0) {
            uint bonusGiveSystemToken = systemTokenAmount * giveBonus / 100;
            vestingContract.vestWithVestType(systemTokenRecipient, bonusGiveSystemToken, vestingFirstPeriodDuration, vestingSecondPeriodDuration, 1); 
            emit ProcessGiveBonus(systemTokenRecipient, bonusGiveSystemToken, block.timestamp);
        }
        _processSponsor(systemTokenAmount);
    }

    function _processSponsor(uint systemTokenAmount) private {
        address sponsorAddress = _getUserSponsorAddress();
        if (sponsorAddress != address(0)) { 
            uint minSystemTokenAmountForBonus = getSystemTokenAmountForToken(swapToken, swapTokenAmountForBonusThreshold);
            if (systemTokenAmount > minSystemTokenAmountForBonus) {
                uint sponsorAmount = SYSTEM_TOKEN.balanceOf(sponsorAddress);
                
                INimbusStakingPool[] memory stakingPoolsSponsorLocal = stakingPoolsSponsor;

                for (uint i; i < stakingPoolsSponsorLocal.length; i++) {
                    if (sponsorAmount > minSystemTokenAmountForBonus) break;
                    sponsorAmount += stakingPoolsSponsorLocal[i].balanceOf(sponsorAddress);
                }
                
                if (sponsorAmount > minSystemTokenAmountForBonus) {
                    uint bonusBase = systemTokenAmount + unclaimedBonusBases[msg.sender];
                    uint sponsorBonusAmount = bonusBase * sponsorBonus / 100;
                    require(SYSTEM_TOKEN.transfer(sponsorAddress, sponsorBonusAmount), "SYSTEM_TOKEN::transfer: transfer failed");
                    unclaimedBonusBases[msg.sender] = 0;
                    emit ProcessSponsorBonus(sponsorAddress, msg.sender, sponsorBonusAmount, block.timestamp);
                } else {
                    unclaimedBonusBases[msg.sender] += systemTokenAmount;
                    emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
                }
            } else {
                unclaimedBonusBases[msg.sender] += systemTokenAmount;
                emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
            }
        } else {
            unclaimedBonusBases[msg.sender] += systemTokenAmount;
            emit AddUnclaimedSponsorBonus(msg.sender, systemTokenAmount);
        }
    }

    function _getUserSponsorAddress() private view returns (address) {
        if (address(referralProgram) == address(0)) {
            return address(0);
        } else {
            return referralProgram.userSponsorAddressByAddress(msg.sender);
        } 
    }

    function buyExactSystemTokenForTokensAndRegister(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgram.registerUserBySponsorId(msg.sender, sponsorId, USER_CATEGORY);
        buyExactSystemTokenForTokens(token, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForTokensAndRegister(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) external whenNotPaused {
        referralProgram.registerUserBySponsorId(msg.sender, 1000000001, USER_CATEGORY);
        buyExactSystemTokenForTokens(token, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnbAndRegister(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) payable external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgram.registerUserBySponsorId(msg.sender, sponsorId, USER_CATEGORY);
        buyExactSystemTokenForBnb(systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnbAndRegister(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) payable external whenNotPaused {
        referralProgram.registerUserBySponsorId(msg.sender, 1000000001, USER_CATEGORY);
        buyExactSystemTokenForBnb(systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnbAndRegister(address systemTokenRecipient, uint stakingPoolId, uint sponsorId) payable external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgram.registerUserBySponsorId(msg.sender, sponsorId, USER_CATEGORY);
        buySystemTokenForExactBnb(systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnbAndRegister(address systemTokenRecipient, uint stakingPoolId) payable external whenNotPaused {
        referralProgram.registerUserBySponsorId(msg.sender, 1000000001, USER_CATEGORY);
        buySystemTokenForExactBnb(systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokensAndRegister(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId, uint sponsorId) external whenNotPaused {
        require(sponsorId >= 1000000001, "NimbusInitialAcquisition: Sponsor id must be grater than 1000000000");
        referralProgram.registerUserBySponsorId(msg.sender, sponsorId, USER_CATEGORY);
        buySystemTokenForExactTokens(token, tokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokensAndRegister(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId) external whenNotPaused {
        referralProgram.registerUserBySponsorId(msg.sender, 1000000001, USER_CATEGORY);
        buySystemTokenForExactTokens(token, tokenAmount, systemTokenRecipient, stakingPoolId);
    }
    
    function buyExactSystemTokenForTokens(address token, uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[token], "NimbusInitialAcquisition: Not allowed token");
        uint tokenAmount = getTokenAmountForSystemToken(token, systemTokenAmount);
        TransferHelper.safeTransferFrom(token, msg.sender, recipient, tokenAmount);
        _buySystemToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactTokens(address token, uint tokenAmount, address systemTokenRecipient, uint stakingPoolId) public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[token], "NimbusInitialAcquisition: Not allowed token");
        uint systemTokenAmount = getSystemTokenAmountForToken(token, tokenAmount);
        TransferHelper.safeTransferFrom(token, msg.sender, recipient, tokenAmount);
        _buySystemToken(token, tokenAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buySystemTokenForExactBnb(address systemTokenRecipient, uint stakingPoolId) payable public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[NBU_WBNB], "NimbusInitialAcquisition: Not allowed purchase for BNB");
        uint systemTokenAmount = getSystemTokenAmountForBnb(msg.value);
        INBU_WBNB(NBU_WBNB).deposit{value: msg.value}();
        _buySystemToken(NBU_WBNB, msg.value, systemTokenAmount, systemTokenRecipient, stakingPoolId);
    }

    function buyExactSystemTokenForBnb(uint systemTokenAmount, address systemTokenRecipient, uint stakingPoolId) payable public whenNotPaused {
        require(address(stakingPools[stakingPoolId]) != address(0), "NimbusInitialAcquisition: No staking pool with provided id");
        require(allowedTokens[NBU_WBNB], "NimbusInitialAcquisition: Not allowed purchase for BNB");
        uint systemTokenAmountMax = getSystemTokenAmountForBnb(msg.value);
        require(systemTokenAmountMax >= systemTokenAmount, "NimbusInitialAcquisition: Not enough BNB");
        uint bnbAmount = systemTokenAmountMax == systemTokenAmount ? msg.value : getBnbAmountForSystemToken(systemTokenAmount);
        INBU_WBNB(NBU_WBNB).deposit{value: bnbAmount}();
        _buySystemToken(NBU_WBNB, bnbAmount, systemTokenAmount, systemTokenRecipient, stakingPoolId);
        // refund dust bnb, if any
        if (systemTokenAmountMax > systemTokenAmount) TransferHelper.safeTransferBNB(msg.sender, msg.value - bnbAmount);
    }

    function claimSponsorBonusesBatch(address[] memory users) external { 
        for (uint i; i < users.length; i++) {
            claimSponsorBonuses(users[i]);
        }
    }

    function claimSponsorBonuses(address user) public {
        require(unclaimedBonusBases[user] > 0, "NimbusInitialAcquisition: No unclaimed bonuses");
        uint userSponsor = referralProgram.userSponsorByAddress(user);
        require(userSponsor == referralProgram.userIdByAddress(msg.sender) && userSponsor != 0, "NimbusInitialAcquisition: Not user sponsor");
        
        uint minSystemTokenAmountForBonus = getSystemTokenAmountForToken(swapToken, swapTokenAmountForBonusThreshold);
        uint bonusBase = unclaimedBonusBases[user];
        require (bonusBase >= minSystemTokenAmountForBonus, "NimbusInitialAcquisition: Bonus threshold not met");
        
        INimbusStakingPool[] memory stakingPoolsSponsorLocal = stakingPoolsSponsor;

        uint sponsorAmount = SYSTEM_TOKEN.balanceOf(msg.sender);
        for (uint i; i < stakingPoolsSponsorLocal.length; i++) {
            if (sponsorAmount > minSystemTokenAmountForBonus) break;
            sponsorAmount += stakingPoolsSponsorLocal[i].balanceOf(msg.sender);
        }
        
        require (sponsorAmount > minSystemTokenAmountForBonus, "NimbusInitialAcquisition: Sponsor balance threshold for bonus not met");
        uint sponsorBonusAmount = bonusBase * sponsorBonus / 100;
        require(SYSTEM_TOKEN.transfer(msg.sender, sponsorBonusAmount), "SYSTEM_TOKEN::transfer: transfer failed");
        unclaimedBonusBases[user] = 0;
        emit ProcessSponsorBonus(msg.sender, user, sponsorBonusAmount, block.timestamp);
    }
    


    //Admin functions
    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "NimbusInitialAcquisition: Can't be zero address");
        require(amount > 0, "NimbusInitialAcquisition: Should be greater than 0");
        TransferHelper.safeTransferBNB(to, amount);
        emit Rescue(to, amount);
    }

    function rescue(address to, address token, uint256 amount) external onlyOwner {
        require(to != address(0), "NimbusInitialAcquisition: Can't be zero address");
        require(amount > 0, "NimbusInitialAcquisition: Should be greater than 0");
        TransferHelper.safeTransfer(token, to, amount);
        emit RescueToken(token, to, amount);
    }

    function updateStakingPool(uint id, address stakingPool) public onlyOwner {
        _updateStakingPool(id, stakingPool);
    }

    function updateStakingPool(uint[] memory ids, address[] memory _stakingPools) external onlyOwner {
        require(ids.length == _stakingPools.length, "NimbusInitialAcquisition: Ids and staking pools arrays have different size.");
        
        for(uint i = 0; i < ids.length; i++) {
            _updateStakingPool(ids[i], _stakingPools[i]);
        }
    }

    function updateAllowedTokens(address token, bool isAllowed) external onlyOwner {
        require (token != address(0), "NimbusInitialAcquisition: Wrong addresses");
        allowedTokens[token] = isAllowed;
        emit AllowedTokenUpdated(token, isAllowed);
    }
    
    function updateRecipient(address recipientAddress) external onlyOwner {
        require(recipientAddress != address(0), "NimbusInitialAcquisition: Address is zero");
        recipient = recipientAddress;
    } 

    function updateSponsorBonus(uint bonus) external onlyOwner {
        sponsorBonus = bonus;
    }

    function updateReferralProgramContract(address newReferralProgramContract) external onlyOwner {
        require(newReferralProgramContract != address(0), "NimbusInitialAcquisition: Address is zero");
        referralProgram = INimbusReferralProgram(newReferralProgramContract);
    }

    function updateStakingPoolAdd(address newStakingPool) external onlyOwner {
        INimbusStakingPool pool = INimbusStakingPool(newStakingPool);
        require (pool.stakingToken() == SYSTEM_TOKEN, "NimbusInitialAcquisition: Wrong pool staking tokens");

        INimbusStakingPool[] memory stakingPoolsSponsorLocal = stakingPoolsSponsor;

        for (uint i; i < stakingPoolsSponsorLocal.length; i++) {
            require (address(stakingPoolsSponsorLocal[i]) != newStakingPool, "NimbusInitialAcquisition: Pool exists");
        }
        stakingPoolsSponsor.push(pool);
    }

    function updateStakingPoolRemove(uint poolIndex) external onlyOwner {
        stakingPoolsSponsor[poolIndex] = stakingPoolsSponsor[stakingPoolsSponsor.length - 1];
        stakingPoolsSponsor.pop();
    }

    function updateSwapRouter(address newSwapRouter) external onlyOwner {
        require(newSwapRouter != address(0), "NimbusInitialAcquisition: Address is zero");
        swapRouter = INimbusRouter(newSwapRouter);
    }

    function updateVestingContract(address vestingContractAddress) external onlyOwner {
        require(Address.isContract(vestingContractAddress), "NimbusInitialAcquisition: VestingContractAddress is not a contract");
        vestingContract = INimbusVesting(vestingContractAddress);
        emit UpdateVestingContract(vestingContractAddress);
    }

    function updateVestingParams(uint vestingFirstPeriod, uint vestingSecondPeriod) external onlyOwner {
        require(vestingFirstPeriod != vestingFirstPeriodDuration && vestingSecondPeriodDuration != vestingSecondPeriod, "NimbusInitialAcquisition: Same params");
        vestingFirstPeriodDuration = vestingFirstPeriod;
        vestingSecondPeriodDuration = vestingSecondPeriod;
        emit UpdateVestingParams(vestingFirstPeriod, vestingSecondPeriod);
    }

    function updateSwapToken(address newSwapToken) external onlyOwner {
        require(newSwapToken != address(0), "NimbusInitialAcquisition: Address is zero");
        swapToken = newSwapToken;
        emit SwapTokenUpdated(swapToken);
    }

    function updateSwapTokenAmountForBonusThreshold(uint threshold) external onlyOwner {
        swapTokenAmountForBonusThreshold = threshold;
        emit SwapTokenAmountForBonusThresholdUpdated(swapTokenAmountForBonusThreshold);
    }

    function updateTokenSystemTokenWeightedExchangeRate(address token, uint rate) external onlyOwner {
        weightedTokenSystemTokenExchangeRates[token] = rate;
        emit UpdateTokenSystemTokenWeightedExchangeRate(token, rate);
    }

    function toggleUseWeightedRates() external onlyOwner {
        useWeightedRates = !useWeightedRates;
        emit ToggleUseWeightedRates(useWeightedRates);
    }

    function _updateStakingPool(uint id, address stakingPool) private {
        require(id != 0, "NimbusInitialAcquisition: Staking pool id cant be equal to 0.");
        require(stakingPool != address(0), "NimbusInitialAcquisition: Staking pool address cant be equal to address(0).");

        stakingPools[id] = INimbusStakingPool(stakingPool);
        require(SYSTEM_TOKEN.approve(stakingPool, type(uint256).max), "NimbusInitialAcquisition: Error on approving");
    }

    function updateGiveBonus(uint bonus) external onlyOwner {
        giveBonus = bonus;
        emit UpdateGiveBonus(bonus);
    }

}

library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferBNB(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: BNB_TRANSFER_FAILED');
    }
}