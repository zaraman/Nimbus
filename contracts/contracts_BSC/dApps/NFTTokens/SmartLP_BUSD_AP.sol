// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }
    function safeTransfer(address token, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }
    function safeTransferFrom(address token, address from, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }
    function safeTransferBNB(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: BNB_TRANSFER_FAILED');
    }
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface IBEP165 {
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

abstract contract ERC165 is IBEP165 {
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IBEP165).interfaceId;
    }
}

interface IBEP721 is IBEP165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;
}

interface IBEP721Metadata is IBEP721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IRouter {
    function swapExactBNBForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
        
        function addLiquidityBNB(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountBNBMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountBNB, uint liquidity);
    function swapExactTokensForBNB(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    function removeLiquidityBNB(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountBNBMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountBNB);
    function getAmountsOut(
        uint amountIn, 
        address[] memory path
    ) external view returns (uint[] memory amounts);
    function NBU_WBNB() external view returns(address);
}

interface IPancakeRouter {
    function WETH() external pure returns (address);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface ILpStaking {
    function stakeNonces (address) external view returns (uint256);
    function stake(uint256 amount) external;
    function stakeFor(uint256 amount, address user) external;
    function getCurrentLPPrice() external view returns (uint);
    function getReward() external;
    function withdraw(uint256 nonce) external;
    function rewardDuration() external returns (uint256);
    function stakingLPToken() external view returns (address);
}

interface IWBNB {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external;
    function withdraw(uint) external;
    function approve(address spender, uint value) external returns (bool);
}

interface ILending {
    //IWBNB
    function mintWithBnb(address receiver) external payable returns (uint256 mintAmount);
    function tokenPrice() external view returns (uint256);
    function burnToBnb(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
    
    //IToken
    function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
    function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
}

interface IPriceFeed {
    function queryRate(address sourceTokenAddress, address destTokenAddress) external view returns (uint256 rate, uint256 precision);
    function wbnbToken() external view returns(address);
}

interface INimbusPair is IERC20Upgradeable {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract SmartLP_APStorage is Initializable, ERC165, ContextUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {    
    IWBNB public WBNB;
    IERC20Upgradeable public purchaseToken;
    IRouter public swapRouter;
    ILpStaking public lpStakingBnbNbu;
    ILpStaking public lpStakingBnbGnbu;
    ILending public lendingContract;
    IERC20Upgradeable public nbuToken;
    IERC20Upgradeable public gnbuToken;

    uint public tokenCount;
    uint public minPurchaseAmountToken;
    uint public rewardDuration;
    uint public lockTime;
    
    struct UserSupply { 
      address ProvidedToken;
      uint ProvidedAmount;
      uint NbuBnbLpAmount;
      uint GnbuBnbLpAmount;
      uint NbuBnbStakeNonce;
      uint GnbuBnbStakeNonce;
      uint LendedBNBAmount;
      uint LendedITokenAmount;
      uint SupplyTime;
      uint TokenId;
      bool IsActive;
    }
    
    mapping(uint => uint[]) internal _userRewards;
    mapping(uint => uint256) internal _balancesRewardEquivalentBnbNbu;
    mapping(uint => uint256) internal _balancesRewardEquivalentBnbGnbu;
    mapping(uint => UserSupply) public tikSupplies;
    mapping(uint => uint256) public weightedStakeDate;

    string internal _name;
    string internal _symbol;
    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(address => uint[]) internal _userTokens;
    IPancakeRouter public pancakeRouter;

    event BuySmartLP(address indexed user, uint indexed tokenId, address providedToken, uint providedBnb, uint supplyTime);
    event WithdrawRewards(address indexed user, uint indexed tokenId, address indexed paymentToken, uint totalNbuReward);
    event BalanceRewardsNotEnough(address indexed user, uint indexed tokenId, uint totalNbuReward);
    event BurnSmartLP(uint indexed tokenId);
    event UpdateSwapRouter(address indexed newSwapRouterContract, address indexed newPancakeRouterContract);
    event UpdateLpStakingBnbNbu(address indexed newLpStakingAContract);
    event UpdateLpStakingBnbNimb(address indexed newLpStakingAContract);
    event UpdateLpStakingBnbGnbu(address indexed newLpStakingBContract);
    event UpdateLendingContract(address indexed newLending);
    event UpdateTokenNbu(address indexed newToken);
    event UpdateTokenGnbu(address indexed newToken);
    event UpdateMinPurchaseAmountToken(uint indexed newAmount);
    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed to, address indexed token, uint amount);
    event UpdateLpStakingBnbGnimb(address indexed newLpStakingContract);
    event UpdateUsePriceFeeds(bool indexed isUsePriceFeeds);
}

contract SmartLP_AP is SmartLP_APStorage, IBEP721, IBEP721Metadata {
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;
    
    address public target;
    IERC20Upgradeable public nimbToken;
    IERC20Upgradeable public gnimbToken;
    IERC20Upgradeable public paymentToken;
    ILpStaking public lpStakingBnbGnimb;
    
    bool public usePriceFeeds;
    IPriceFeed public priceFeed;

    mapping(uint256 => uint256) internal _balancesRewardEquivalentBnbGnimb;
    mapping(uint256 => bool) public GnimbPurchases;

    ILpStaking public lpStakingBnbNimb;

    mapping(uint256 => uint256) internal _balancesRewardEquivalentBnbNimb;
    mapping(uint256 => bool) public NimbPurchases;

    function initialize(
        address _swapRouter, 
        address _pancakeRouter,
        address _purchaseToken,
        address _nimbToken, 
        address _gnimbToken, 
        address _bnbNimbPair, 
        address _gnimbBnbPair, 
        address _lpStakingBnbNimb, 
        address _lpStakingBnbGnimb, 
        address _priceFeed
    ) public initializer {
        __Context_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        require(
            AddressUpgradeable.isContract(_swapRouter) && 
            AddressUpgradeable.isContract(_pancakeRouter) && 
            AddressUpgradeable.isContract(_purchaseToken) && 
            AddressUpgradeable.isContract(_nimbToken) && 
            AddressUpgradeable.isContract(_gnimbToken) && 
            AddressUpgradeable.isContract(_bnbNimbPair) && 
            AddressUpgradeable.isContract(_gnimbBnbPair) && 
            AddressUpgradeable.isContract(_lpStakingBnbNimb) && 
            AddressUpgradeable.isContract(_lpStakingBnbGnimb) && 
            AddressUpgradeable.isContract(_priceFeed)
            , "Not contract");

        _name = "Smart LP BUSD Affiliate Program";
        _symbol = "SL_BUSD_AP";
        
        swapRouter = IRouter(_swapRouter);
        pancakeRouter = IPancakeRouter(_pancakeRouter);
        purchaseToken = IERC20Upgradeable(_purchaseToken);
        WBNB = IWBNB(swapRouter.NBU_WBNB());
        nimbToken = IERC20Upgradeable(_nimbToken);
        gnimbToken = IERC20Upgradeable(_gnimbToken);
        lpStakingBnbNimb = ILpStaking(_lpStakingBnbNimb);
        lpStakingBnbGnimb = ILpStaking(_lpStakingBnbGnimb);
        
        paymentToken = nimbToken;
        priceFeed = IPriceFeed(_priceFeed);
        usePriceFeeds = true;

        rewardDuration = ILpStaking(_lpStakingBnbNimb).rewardDuration();
        minPurchaseAmountToken = 200 ether;
        lockTime = 180 days;

        IERC20Upgradeable(_nimbToken).approve(_swapRouter, type(uint256).max);
        IERC20Upgradeable(_gnimbToken).approve(_swapRouter, type(uint256).max);
        IERC20Upgradeable(_purchaseToken).approve(_pancakeRouter, type(uint256).max);
        IERC20Upgradeable(_bnbNimbPair).approve(address(_swapRouter), type(uint256).max);
        IERC20Upgradeable(_bnbNimbPair).approve(address(_lpStakingBnbNimb), type(uint256).max);
        IERC20Upgradeable(_gnimbBnbPair).approve(address(_lpStakingBnbGnimb), type(uint256).max);  
        IERC20Upgradeable(_gnimbBnbPair).approve(address(_swapRouter), type(uint256).max);  
    }

    receive() external payable {
        assert(
            msg.sender == address(WBNB) || msg.sender == address(swapRouter) || msg.sender == address(pancakeRouter)
        );
    }
    
    // ========================== SmartLP functions ==========================

    function buySmartLPforToken(uint256 amount) external {
        require(amount >= minPurchaseAmountToken, 'SmartLP: Token price is more than sent');
        TransferHelper.safeTransferFrom(address(purchaseToken), msg.sender, address(this), amount);

        tokenCount = ++tokenCount;

        address[] memory path = new address[](2);
        path[0] = address(purchaseToken);
        path[1] = pancakeRouter.WETH();
        (uint[] memory amountsTokenBnb) = pancakeRouter.swapExactTokensForETH(amount, 0, path, address(this), block.timestamp + 1200);
        uint256 amountBNB = amountsTokenBnb[1];
        uint256 tokenId = buySmartLP(amountBNB);
        tikSupplies[tokenId].ProvidedToken = address(purchaseToken);
        tikSupplies[tokenId].ProvidedAmount = amount;

        emit BuySmartLP(msg.sender, tokenCount, address(purchaseToken), amount, block.timestamp);
    }

    function buySmartLP(uint256 amountBNB) private returns (uint256){
        uint swapAmount = amountBNB/4;
        
        address[] memory path = new address[](2);
        path[0] = address(WBNB);
        path[1] = address(nimbToken);
        (uint[] memory amountsBnbNimbSwap) = swapRouter.swapExactBNBForTokens{value: swapAmount}(0, path, address(this), block.timestamp);

        path[1] = address(gnimbToken);      
        (uint[] memory amountsBnbGnimbSwap) = swapRouter.swapExactBNBForTokens{value: swapAmount}(0, path, address(this), block.timestamp);      
        amountBNB -= swapAmount * 2;
        
        (, uint amountBnbNimb, uint liquidityBnbNimb) = swapRouter.addLiquidityBNB{value: amountBNB}(address(nimbToken), amountsBnbNimbSwap[1], 0, 0, address(this), block.timestamp);
        amountBNB -= amountBnbNimb;
        
        (, uint amountBnbGnimb, uint liquidityBnbGnimb) = swapRouter.addLiquidityBNB{value: amountBNB}(address(gnimbToken), amountsBnbGnimbSwap[1], 0, 0, address(this), block.timestamp);
        amountBNB -= amountBnbGnimb;
        
        uint256 noncesBnbNimb = lpStakingBnbNimb.stakeNonces(address(this));
        lpStakingBnbNimb.stake(liquidityBnbNimb);
        uint amountRewardEquivalentBnbNimb = lpStakingBnbNimb.getCurrentLPPrice() * liquidityBnbNimb / 1e18;
        _balancesRewardEquivalentBnbNimb[tokenCount] += amountRewardEquivalentBnbNimb;

        uint256 noncesBnbGnimb = lpStakingBnbGnimb.stakeNonces(address(this));
        lpStakingBnbGnimb.stake(liquidityBnbGnimb);
        uint amountRewardEquivalentBnbGnimb = lpStakingBnbGnimb.getCurrentLPPrice() * liquidityBnbGnimb / 1e18;
        _balancesRewardEquivalentBnbGnimb[tokenCount] += amountRewardEquivalentBnbGnimb;
        
        UserSupply storage userSupply = tikSupplies[tokenCount];
        userSupply.IsActive = true;
        userSupply.GnbuBnbLpAmount = liquidityBnbGnimb;
        userSupply.NbuBnbLpAmount = liquidityBnbNimb;
        userSupply.NbuBnbStakeNonce = noncesBnbNimb;
        userSupply.GnbuBnbStakeNonce = noncesBnbGnimb;
        userSupply.SupplyTime = block.timestamp;
        userSupply.TokenId = tokenCount;

        weightedStakeDate[tokenCount] = userSupply.SupplyTime;
        _userTokens[msg.sender].push(tokenCount); 
        _mint(msg.sender, tokenCount);

        GnimbPurchases[tokenCount] = true;
        NimbPurchases[tokenCount] = true;

        return tokenCount;
    }
    
    function withdrawUserRewards(uint tokenId) external nonReentrant {
        require(_owners[tokenId] == msg.sender, "SmartLP: Not token owner");
        UserSupply memory userSupply = tikSupplies[tokenId];
        require(userSupply.IsActive, "SmartLP: Not active");
        (uint nbuReward, ) = getTotalAmountsOfRewards(tokenId);
        _withdrawUserRewards(tokenId, nbuReward);
    }
    
    function burnSmartLP(uint tokenId) external nonReentrant {
        require(_owners[tokenId] == msg.sender, "SmartLP: Not token owner");
        UserSupply storage userSupply = tikSupplies[tokenId];
        require(block.timestamp > userSupply.SupplyTime + lockTime, "SmartLP: Token is locked");
        require(userSupply.IsActive, "SmartLP: Token not active");
        (uint nbuReward, ) = getTotalAmountsOfRewards(tokenId);
        
        if(nbuReward > 0) {
            _withdrawUserRewards(tokenId, nbuReward);
        }

        if (NimbPurchases[tokenId]) {
            lpStakingBnbNimb.withdraw(userSupply.NbuBnbStakeNonce);
            swapRouter.removeLiquidityBNB(address(nimbToken), userSupply.NbuBnbLpAmount, 0, 0,  msg.sender, block.timestamp);
        } else {
            lpStakingBnbNbu.withdraw(userSupply.NbuBnbStakeNonce);
            (uint nbuAmount, uint bnbAmount) = swapRouter.removeLiquidityBNB(address(nbuToken), userSupply.NbuBnbLpAmount, 0, 0, address(this), block.timestamp);
            TransferHelper.safeTransfer(address(nimbToken), msg.sender, nbuAmount);
            TransferHelper.safeTransferBNB(msg.sender, bnbAmount);
        }
        
        if (GnimbPurchases[tokenId]) {
            lpStakingBnbGnimb.withdraw(userSupply.GnbuBnbStakeNonce);
            swapRouter.removeLiquidityBNB(address(gnimbToken), userSupply.GnbuBnbLpAmount, 0, 0, msg.sender, block.timestamp);
        } else {
            lpStakingBnbGnbu.withdraw(userSupply.GnbuBnbStakeNonce);
            (uint gnbuAmount, uint bnbAmount) = swapRouter.removeLiquidityBNB(address(gnbuToken), userSupply.GnbuBnbLpAmount, 0, 0, address(this), block.timestamp);
            TransferHelper.safeTransfer(address(gnimbToken), msg.sender, gnbuAmount);
            TransferHelper.safeTransferBNB(msg.sender, bnbAmount);
        }

        if (userSupply.LendedITokenAmount > 0) {
            lendingContract.burn(msg.sender, userSupply.LendedITokenAmount);
        }
        
        transferFrom(msg.sender, address(0x1), tokenId);
        userSupply.IsActive = false;
        
        emit BurnSmartLP(tokenId);      
    }

    function getTokenRewardsAmounts(uint tokenId) public view returns (uint lpBnbNimbUserRewards, uint lpBnbGnbuUserRewards, uint lendedUserRewards) {
        UserSupply memory userSupply = tikSupplies[tokenId];
        require(userSupply.IsActive, "SmartLP: Not active");

        uint convertITokenToToken = 0;
        
        lpBnbNimbUserRewards = ((_balancesRewardEquivalentBnbNbu[tokenId] + _balancesRewardEquivalentBnbNimb[tokenId]) * ((block.timestamp - weightedStakeDate[tokenId]) * 45)) / (100 * rewardDuration);
        lpBnbGnbuUserRewards = ((_balancesRewardEquivalentBnbGnbu[tokenId] + _balancesRewardEquivalentBnbGnimb[tokenId]) * ((block.timestamp - weightedStakeDate[tokenId]) * 45)) / (100 * rewardDuration);
        lendedUserRewards = (convertITokenToToken > userSupply.LendedBNBAmount) ? (convertITokenToToken - userSupply.LendedBNBAmount) : 0;
    }
    
    function getTotalAmountsOfRewards(uint tokenId) public view returns (uint nbuReward, uint busdReward) {
        (uint lpBnbNimbUserRewards, uint lpBnbGnbuUserRewards, uint rewardsLend) = getTokenRewardsAmounts(tokenId);
        nbuReward = getTokenAmountForToken(
            address(nimbToken), 
            address(paymentToken), 
            lpBnbNimbUserRewards + lpBnbGnbuUserRewards
        );
        busdReward = rewardsLend;
    }
    
    function getUserTokens(address user) public view returns (uint[] memory) {
        return _userTokens[user];
    }

    function _withdrawUserRewards(uint tokenId, uint totalNbuReward) private {
        require(totalNbuReward > 0, "SmartLP: Claim not enough");
        address tokenOwner = _owners[tokenId];
        TransferHelper.safeTransfer(address(paymentToken), tokenOwner, totalNbuReward);
        weightedStakeDate[tokenId] = block.timestamp;

        emit WithdrawRewards(tokenOwner, tokenId, address(paymentToken), totalNbuReward);
    }

    function getTokenAmountForToken(address tokenSrc, address tokenDest, uint256 tokenAmount) public view returns (uint) { 
        if (tokenSrc == tokenDest) return tokenAmount;
        if (usePriceFeeds && address(priceFeed) != address(0)) {
            (uint256 rate, uint256 precision) = priceFeed.queryRate(tokenSrc, tokenDest);
            return tokenAmount * rate / precision;
        } 
        address[] memory path = new address[](2);
        path[0] = tokenSrc;
        path[1] = tokenDest;
        return swapRouter.getAmountsOut(tokenAmount, path)[1];
    }

    function getNftLpInfo(uint256 tokenId) public view returns (uint lpNimbBnb, uint lpNimbToken, uint lpGnimbBnb, uint lpGnimbToken) {
        INimbusPair curGnimbPair = GnimbPurchases[tokenId] ? INimbusPair(lpStakingBnbGnimb.stakingLPToken()) : INimbusPair(lpStakingBnbGnbu.stakingLPToken());
        INimbusPair curNimbPair = NimbPurchases[tokenId] ? INimbusPair(lpStakingBnbNimb.stakingLPToken()) : INimbusPair(lpStakingBnbNbu.stakingLPToken());

        (uint112 gnimbReserve0, uint112 gnimbReserve1,) = curGnimbPair.getReserves();
        (uint112 nimbReserve0, uint112 nimbReserve1,) = curNimbPair.getReserves();

        uint256 gnimbPairPerc = (tikSupplies[tokenId].GnbuBnbLpAmount * 1 ether) / curGnimbPair.totalSupply();
        uint256 nimbPairPerc = (tikSupplies[tokenId].NbuBnbLpAmount * 1 ether) / curNimbPair.totalSupply();

        bool gnimbPairBnbToken0 = curGnimbPair.token0() == swapRouter.NBU_WBNB();
        lpGnimbBnb = (gnimbPairPerc * (gnimbPairBnbToken0 ? gnimbReserve0 : gnimbReserve1)) / 1 ether;
        lpGnimbToken = (gnimbPairPerc * (gnimbPairBnbToken0 ? gnimbReserve1 : gnimbReserve0)) / 1 ether;

        bool nimbPairBnbToken0 = curNimbPair.token0() == swapRouter.NBU_WBNB();
        lpNimbBnb = (nimbPairPerc * (nimbPairBnbToken0 ? nimbReserve0 : nimbReserve1)) / 1 ether;
        lpNimbToken = (nimbPairPerc * (nimbPairBnbToken0 ? nimbReserve1 : nimbReserve0)) / 1 ether;
    }

    // ========================== EIP 721 functions ==========================

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IBEP165) returns (bool) {
        return
            interfaceId == type(IBEP721).interfaceId ||
            interfaceId == type(IBEP721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function approve(address to, uint256 tokenId) public virtual override {
        address owner = SmartLP_AP.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    
    
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = SmartLP_AP.ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = SmartLP_AP.ownerOf(tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner] -= 1;
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: transfer to the zero address");
        require(SmartLP_AP.ownerOf(tokenId) == from, "ERC721: transfer of token that is not owner");

        for (uint256 i; i < _userTokens[from].length; i++) {
            if(_userTokens[from][i] == tokenId) {
                _remove(i, from);
                break;
            }
        }
        // Clear approvals from the previous owner
        _approve(address(0), tokenId);
        _userTokens[to].push(tokenId);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _remove(uint index, address tokenOwner) internal virtual {
        _userTokens[tokenOwner][index] = _userTokens[tokenOwner][_userTokens[tokenOwner].length - 1];
        _userTokens[tokenOwner].pop();
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(SmartLP_AP.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll( address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _checkOnERC721Received(address from, address to,uint256 tokenId, bytes memory _data) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    // ========================== Owner functions ==========================

    function rescue(address to, address tokenAddressUpgradeable, uint256 amount) external onlyOwner {
        require(to != address(0), "SmartLP: Cannot rescue to the zero address");
        require(amount > 0, "SmartLP: Cannot rescue 0");

        IERC20Upgradeable(tokenAddressUpgradeable).transfer(to, amount);
        emit RescueToken(to, address(tokenAddressUpgradeable), amount);
    }

    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "SmartLP: Cannot rescue to the zero address");
        require(amount > 0, "SmartLP: Cannot rescue 0");

        to.transfer(amount);
        emit Rescue(to, amount);
    }

    function updatePaymentToken(address _paymentToken) external onlyOwner {
        require(AddressUpgradeable.isContract(_paymentToken), "SmartLP: Not a contract");
        paymentToken = IERC20Upgradeable(_paymentToken);
    }

    function updateSwapRouter(address newSwapRouter, address newPancakeRouter) external onlyOwner {
        require(AddressUpgradeable.isContract(newSwapRouter), "SmartLP: Not a contract");
        swapRouter = IRouter(newSwapRouter);
        pancakeRouter = IPancakeRouter(newPancakeRouter);
        IERC20Upgradeable(purchaseToken).approve(address(pancakeRouter), type(uint256).max);
        emit UpdateSwapRouter(newSwapRouter, newPancakeRouter);
    }

    function updateNimbTokenContract(address _nimbToken, address _NimbBnbPair, address newLpStaking) external onlyOwner {
        require(AddressUpgradeable.isContract(_nimbToken) && AddressUpgradeable.isContract(_NimbBnbPair) && AddressUpgradeable.isContract(newLpStaking), "SmartLP: Not a contract");
        lpStakingBnbNimb = ILpStaking(newLpStaking);
        IERC20Upgradeable(_nimbToken).approve(address(swapRouter), type(uint256).max);
        IERC20Upgradeable(_NimbBnbPair).approve(address(lpStakingBnbNimb), type(uint256).max);  
        IERC20Upgradeable(_NimbBnbPair).approve(address(swapRouter), type(uint256).max);  
        nimbToken = IERC20Upgradeable(_nimbToken);
        emit UpdateLpStakingBnbNimb(newLpStaking);
    }
    
    function updateGnimbTokenContract(address _gnimbToken, address _GnimbBnbPair,address newLpStaking) external onlyOwner {
        require(AddressUpgradeable.isContract(_gnimbToken) && AddressUpgradeable.isContract(_GnimbBnbPair) && AddressUpgradeable.isContract(newLpStaking), "SmartLP: Not a contract");
        lpStakingBnbGnimb = ILpStaking(newLpStaking);
        IERC20Upgradeable(_gnimbToken).approve(address(swapRouter), type(uint256).max);
        IERC20Upgradeable(_GnimbBnbPair).approve(address(lpStakingBnbGnimb), type(uint256).max);  
        IERC20Upgradeable(_GnimbBnbPair).approve(address(swapRouter), type(uint256).max);  
        gnimbToken = IERC20Upgradeable(_gnimbToken);
        emit UpdateLpStakingBnbGnimb(newLpStaking);
    }
    
    function updateLendingContract(address _newLendingContract) external onlyOwner {
        require(AddressUpgradeable.isContract(_newLendingContract), "SmartLP: Not a contract");
        lendingContract = ILending(_newLendingContract);
        IERC20Upgradeable(purchaseToken).approve(_newLendingContract, type(uint256).max);
        emit UpdateLendingContract(_newLendingContract);
    }

    function updateLockTime(uint256 _lockTime) external onlyOwner {
        lockTime = _lockTime;
    }
    
    function updateTokenAllowance(address token, address spender, int amount) external onlyOwner {
        require(AddressUpgradeable.isContract(token), "SmartLP: Not a contract");
        uint allowance;
        if (amount < 0) {
            allowance = type(uint256).max;
        } else {
            allowance = uint256(amount);
        }
        IERC20Upgradeable(token).approve(spender, allowance);
    }

    function updatePurchaseToken (address _purchaseToken) external onlyOwner {
        require(AddressUpgradeable.isContract(_purchaseToken), "SmartLP: Not a contract");
        purchaseToken = IERC20Upgradeable(_purchaseToken);
        IERC20Upgradeable(_purchaseToken).approve(address(pancakeRouter), type(uint256).max);
    }

    function updateMinPurchaseAmountToken (uint newAmount) external onlyOwner {
        require(newAmount > 0, "SmartLP: Amount must be greater than zero");
        minPurchaseAmountToken = newAmount;
        emit UpdateMinPurchaseAmountToken(newAmount);
    }

    function updatePriceFeed(address newPriceFeed) external onlyOwner {
        require(newPriceFeed != address(0), "StakingRewardFixedAPY: Address is zero");
        priceFeed = IPriceFeed(newPriceFeed);
    }

    function updateUsePriceFeeds(bool isUsePriceFeeds) external onlyOwner {
        usePriceFeeds = isUsePriceFeeds;
        emit UpdateUsePriceFeeds(isUsePriceFeeds);
    }
}
