// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface INimbusRouter {
    function swapExactTokensForBNB(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function NBU_WBNB() external view returns (address);
}

interface IPancakeRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function WETH() external view returns (address);
}

interface ILockStakingRewards {
    function earned(address account) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function stake(uint256 amount) external;

    function stakeLocks(
        address user,
        uint stakeNonce
    ) external returns (uint256);

    function stakeAmounts(
        address user,
        uint stakeNonce
    ) external returns (uint256);

    function stakeFor(uint256 amount, address user) external;

    function getReward() external;

    function withdraw(uint256 nonce) external;

    function withdrawAndGetReward(uint256 nonce) external;

    function lockDuration() external returns (uint256);
}

contract TakeIT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    OwnableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct PurchaseRecord {
        address token;
        uint256 amount;
        uint256 purchased;
        uint256 distributed;
        uint256 rate;
        uint256 amountBusd;
    }

    struct StakingInfo {
        address user;
        uint256 nonce;
        uint256 stakingTime;
        uint256 amount;
        uint256 rate;
        uint256 bnbBusdRate;
    }

    CountersUpgradeable.Counter private _tokenIdCounter;

    IERC20Upgradeable public purchaseToken;
    uint256 public lastTokenId;
    uint256 public soldTokens;

    string public baseUri;

    mapping(uint256 => PurchaseRecord) public purchaseRecords;

    mapping(address => bool) public allowedUpdaters;

    event PurchasedNFT(
        address newOwner,
        uint256 tokenId,
        address purchaseToken,
        uint256 purchaseAmount,
        uint256 stakingNonce,
        uint256 stakingTime
    );
    event Distribute(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 tokenId
    );
    event SetAmountRate(
        uint256 tokenId,
        uint256 amount,
        uint256 rate,
        uint256 bnbBusdRate
    );
    event UpdateBonusRate(uint256 newBonusRate);
    event UpdateRouters(address newNimbusRouter, address newPancakeRouter);
    event SupplyBusd(
        address tokenOwner,
        uint256 indexed tokenId,
        uint256 amountBusd
    );
    event SetStakingContract(address stakingContract);
    event TokensUpdated(address purchaseToken, address busd);
    event ConfirmOrder(
        uint256 indexed tokenId,
        uint256 nbuToSwap,
        uint256 resultedBusd,
        bool isMannual
    );

    string public description;

    ILockStakingRewards public stakingContract;
    mapping(uint256 => StakingInfo) public stakingInfos;
    mapping(address => mapping(uint256 => bool)) public usedStakes;

    IERC20Upgradeable public BusdContract;

    INimbusRouter public nimbusRouter;
    IPancakeRouter public pancakeRouter;
    uint256 public bonusRate;
    mapping(address => bool) public allowedMarketMakers;

    /**
     * @dev Checks if msg.sender is allowed to update state
     */
    modifier onlyAllowedUpdaters() {
        require(
            allowedUpdaters[msg.sender],
            "Provided address is not a allowed updater"
        );
        _;
    }

    /**
     * @dev Checks if msg.sender is allowed to update state
     */
    modifier onlyAllowedMarketMakers() {
        require(
            allowedMarketMakers[msg.sender],
            "Provided address is not allowed market maker"
        );
        _;
    }

    /**
     * @dev This method recieves bnb native coin if msg.sender is Nimbus router or WBNB address
     */
    receive() external payable {
        require(
            msg.sender == nimbusRouter.NBU_WBNB() ||
                msg.sender == address(nimbusRouter),
            "NFT: receiving BNB is not allowed"
        );
    }

    /**
     * @notice Initialize state of contract
     * @param _purchaseToken - token that was staked (initially it is NBU)
     * @param _stakingContract - staking contract
     * @param _busdContract - payment token (BUSD)
     * @dev This method sets staking token, payment token and staking contract address
     */
    function initialize(
        address _purchaseToken,
        address _stakingContract,
        address _busdContract
    ) public initializer {
        __ERC721_init("Take IT", "TAKEIT");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __Ownable_init();

        require(
            AddressUpgradeable.isContract(_purchaseToken),
            "Purchase token should be a contract"
        );
        purchaseToken = IERC20Upgradeable(_purchaseToken);
        require(
            AddressUpgradeable.isContract(_busdContract),
            "Busd should be a contract"
        );
        BusdContract = IERC20Upgradeable(_busdContract);

        stakingContract = ILockStakingRewards(_stakingContract);
        baseUri = "";
    }

    /**
     * @notice Updates staking contract
     * @param _stakingContract - staking contract
     * @dev This method sets new staking contract address if changed
     */
    function changeStakingContract(
        address _stakingContract
    ) external onlyOwner {
        require(
            AddressUpgradeable.isContract(_stakingContract),
            "Staking contract should be a contract"
        );

        stakingContract = ILockStakingRewards(_stakingContract);

        emit SetStakingContract(_stakingContract);
    }

    /**
     * @notice Purchase of NFT for particular withdrawn staking
     * @param to - address of user to owe NFT
     * @param amount - amount of NBU tokens
     * @param stakingNonce - staking nonce for particular NFT
     * @dev This method creates an NFT and sends it to user.
     * NFT is created for particular withdrawn staking with is determined by staking nonce.
     */
    function purchase(address to, uint256 amount, uint256 stakingNonce) public {
        require(
            to == msg.sender || allowedUpdaters[msg.sender],
            "Cannot purchase NFT for another user"
        );
        require(amount > 0, "Amount should be more then 0");
        require(
            purchaseToken.allowance(msg.sender, address(this)) >= amount,
            "Purchase price is more then allowance"
        );
        require(
            purchaseToken.balanceOf(msg.sender) >= amount,
            "Purchase price is less then sender balance"
        );
        uint256 tokenId = _tokenIdCounter.current();

        require(!usedStakes[to][stakingNonce], "NFT: Already exists");
        require(
            stakingContract.stakeAmounts(to, stakingNonce) == 0,
            "NFT: invalid staking nonce"
        );

        uint256 stakeLocks = stakingContract.stakeLocks(to, stakingNonce);
        require(stakeLocks > 0, "NFT: invalid staking lock time");

        _tokenIdCounter.increment();

        purchaseToken.safeTransferFrom(msg.sender, address(this), amount);

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, "");
        lastTokenId = tokenId;
        purchaseRecords[lastTokenId].token = address(purchaseToken);
        purchaseRecords[lastTokenId].amount = amount;
        purchaseRecords[lastTokenId].purchased = block.timestamp;
        soldTokens += 1;
        uint256 stakingTime = stakeLocks - stakingContract.lockDuration();
        stakingInfos[tokenId] = StakingInfo(
            to,
            stakingNonce,
            stakingTime,
            0,
            0,
            0
        );
        usedStakes[to][stakingNonce] = true;

        emit PurchasedNFT(
            to,
            tokenId,
            address(purchaseToken),
            amount,
            stakingNonce,
            block.timestamp
        );
    }

    /**
     * @notice Distribution of unreleased NBU
     * @param to - address of user to distribute unreleased NBU
     * @param tokenId - NFT id
     * @dev This method rescues unreleases NBU by particular tokenId to some reciepient.
     * Only owner cam execute this method
     */
    function distribute(address to, uint256 tokenId) external onlyOwner {
        require(to != address(0), "Can't be zero address");
        require(tokenId <= lastTokenId, "Token not exist");
        require(
            purchaseRecords[tokenId].distributed == 0,
            "Already distributed"
        );

        purchaseToken.safeTransfer(to, purchaseRecords[tokenId].amount);
        purchaseRecords[tokenId].distributed = block.timestamp;

        emit Distribute(
            address(purchaseToken),
            to,
            purchaseRecords[tokenId].amount,
            tokenId
        );
    }

    /**
     * @notice Setting up of staking parameters by particular nonce
     * @param tokenId - NFT id
     * @param amount - amount of token that was staked by nonce registered for particular tokenId
     * @param rate - historical rate NBU/BNB
     * @param bnbBusdRate - historical rate NBU/BUSD
     * @dev This method sets staking amount and historical rates of staking by particular staking nonce.
     * Only allowed updaters can execute this method/
     */
    function setAmountRate(
        uint256 tokenId,
        uint256 amount,
        uint256 rate,
        uint256 bnbBusdRate
    ) external onlyAllowedUpdaters {
        require(tokenId <= lastTokenId, "Token not exist");
        require(
            amount >= purchaseRecords[tokenId].amount,
            "Staking amount is less than amount"
        );

        purchaseRecords[tokenId].rate = rate;
        stakingInfos[tokenId].amount = purchaseRecords[tokenId].amount;
        stakingInfos[tokenId].rate = rate;
        stakingInfos[tokenId].bnbBusdRate = bnbBusdRate;

        emit SetAmountRate(tokenId, amount, rate, bnbBusdRate);
    }

    /**
     * @notice View method to get nbu staking amount and all needed historical rates.
     * @param tokenId - NFT id
     * @dev This method is to get nbu staking amount and historical rates for particular tokenId
     * Returns NBU/BNB rate, BUSD/BNB rate, NBU stakin amount, NBU/BUSD
     */
    function getAmountsAndRates(
        uint256 tokenId
    )
        public
        view
        returns (
            uint256 BnbNburate,
            uint256 BnbBusdRate,
            uint256 NBUAmount,
            uint256 BusdNbuRate
        )
    {
        BnbNburate = stakingInfos[tokenId].rate;
        NBUAmount = stakingInfos[tokenId].amount;
        BnbBusdRate = stakingInfos[tokenId].bnbBusdRate;
        BusdNbuRate = (BnbNburate * 1 ether) / BnbBusdRate;
    }

    /**
     * @notice View method to get tokens reserves
     * @param tokenId - NFT id
     * @dev This method is to get staking token reserve (how much is left)
     * and payment token reserve (how much was received)
     * Returns reserve of NBU for particlular tokenId
     * and amount of BUSD that was received for swapping NBU
     */
    function getTokenReserves(
        uint tokenId
    ) public view returns (uint256 amountNbu, uint256 amountBusd) {
        amountNbu = purchaseRecords[tokenId].amount;
        (, , , uint256 BusdNbuRate) = getAmountsAndRates(tokenId);
        amountBusd = (amountNbu * BusdNbuRate) / 1 ether;
    }

    struct Rates {
        uint256 NbuBnbRate;
        uint256 NbuAmount;
        uint256 BusdBnbRate;
        uint256 NbuBusdRate;
        uint256 reserveNbu;
        uint256 amountBusd;
    }

    function getListAmountsRates(
        uint256 from,
        uint256 to
    ) public view returns (Rates[] memory) {
        uint256 length = to - from;
        Rates[] memory RatesList = new Rates[](length);
        for (uint256 i = 0; i < length; i++) {
            Rates memory rates;
            uint256 tokenId = from + i;
            (
                rates.NbuBnbRate,
                rates.NbuAmount,
                rates.BusdBnbRate,
                rates.NbuBusdRate
            ) = getAmountsAndRates(tokenId);
            (rates.reserveNbu, rates.amountBusd) = getTokenReserves(tokenId);
            RatesList[i] = rates;
        }
        return RatesList;
    }

    /**
     * @notice Burning of NFT
     * @param tokenId - NFT id
     * @dev This method burns NFT by particular tokenId. Can be called only by NFT owner.
     * Can be burned only if there is no more NBU to swap.
     */
    function burnNFT(uint256 tokenId) external {
        require(msg.sender == ownerOf(tokenId), "Caller is not owner");
        (uint256 reserveNbu, ) = getTokenReserves(tokenId);
        require(reserveNbu == 0, "NBU amount not fully distributed yet");
        _burn(tokenId);
        BusdContract.safeTransfer(msg.sender, purchaseRecords[tokenId].amountBusd);
    }

    /**
     * @notice Supplies BUSD for particular tokenId
     * @param tokenId - NFT id
     * @param busdToSend - BUSD that is sended
     * @dev This method sends BUSD and updates NBU reserves
     * Can be executed only by allowed market makers
     */
    function supplyBusd(
        uint256 tokenId,
        uint256 busdToSend
    ) external onlyAllowedMarketMakers {
        (, uint256 reserveBusd) = getTokenReserves(tokenId);
        require(busdToSend > 0, "Incorrect BUSD amount was given");
        require(
            reserveBusd >= busdToSend,
            "BUSD token reserve is insufficient"
        );
        (, , , uint256 NbuBusdRate) = getAmountsAndRates(tokenId);
        uint256 nbuPurchased = busdToSend * NbuBusdRate;
        purchaseRecords[tokenId].amount -= nbuPurchased;
        purchaseRecords[tokenId].amountBusd += busdToSend;
        BusdContract.safeTransfer(ownerOf(tokenId), busdToSend);

        emit ConfirmOrder(tokenId, nbuPurchased, busdToSend, true);
    }

    /**
     * @notice Force unlock particular tokenId for burn
     * @param tokenId - NFT id
     * @dev This method unlocks token for burn buy setting nbu amount to 0
     * Can be executed only by allowed market makers
     */
    function forceUnlockNftForBurn(uint256 tokenId) external onlyOwner {
        emit ConfirmOrder(tokenId, purchaseRecords[tokenId].amount, 0, true);
        purchaseRecords[tokenId].amount = 0;
    }

    function getBusdBNBamount(
        uint256 tokenId,
        uint256 amountNbu
    )
        public
        view
        returns (
            uint256 amountBusd,
            uint amountBNB,
            uint BusdNbuRate,
            uint BnbNburate,
            uint NBUAmount,
            uint BnbBusdRate
        )
    {
        address[] memory path = new address[](2);
        path[0] = address(purchaseToken);
        path[1] = nimbusRouter.NBU_WBNB();
        uint[] memory amountsNbuBNB = INimbusRouter(nimbusRouter).getAmountsOut(
            amountNbu,
            path
        );
        amountBNB = amountsNbuBNB[1];
        path[0] = pancakeRouter.WETH();
        path[1] = address(BusdContract);
        uint[] memory amountsBNBBusd = IPancakeRouter(pancakeRouter)
            .getAmountsOut(amountBNB, path);
        amountBusd = amountsBNBBusd[1];
        BnbNburate = (amountsNbuBNB[1] * 1 ether) / amountsNbuBNB[0];
        NBUAmount = stakingInfos[tokenId].amount;
        BnbBusdRate = (amountsBNBBusd[0] * 1 ether) / amountsBNBBusd[1];
        BusdNbuRate = (BnbNburate * 1 ether) / BnbBusdRate;
    }

    function getNbuBusdRate(
        uint256 amountNbu
    ) public view returns (uint256 amountBusd) {
        address[] memory path = new address[](2);
        path[0] = address(purchaseToken);
        path[1] = nimbusRouter.NBU_WBNB();
        uint[] memory amountsNbuBNB = INimbusRouter(nimbusRouter).getAmountsOut(
            amountNbu,
            path
        );
        path[0] = pancakeRouter.WETH();
        path[1] = address(BusdContract);
        uint[] memory amountsBNBBusd = IPancakeRouter(pancakeRouter)
            .getAmountsOut(amountsNbuBNB[1], path);
        amountBusd = amountsBNBBusd[1];
    }

    /**
     * @notice Auto swap of NBU via swap machines
     * @param tokenId - NFT id
     * @param amountToSwap - amount of NBU to swap
     * @dev This method confirms order swapping NBU->BUSD using path NBU->BNB->BUSD
     * Can be executed only by allowed market makers
     */
    function confirmOrder(
        uint256 tokenId,
        uint256 amountToSwap
    ) external onlyAllowedMarketMakers {
        require(amountToSwap > 0, "NBU amount should be more than 0");
        require(
            purchaseRecords[tokenId].amount >= amountToSwap,
            "Not enough NBU reserve to confirm swap"
        );
        require(purchaseRecords[tokenId].rate != 0, "Rate is not set");
        purchaseRecords[tokenId].amount -= amountToSwap;
        address[] memory path = new address[](2);
        path[0] = address(purchaseToken);
        path[1] = nimbusRouter.NBU_WBNB();
        uint[] memory amountsNbuBNB = INimbusRouter(nimbusRouter)
            .swapExactTokensForBNB(
                amountToSwap,
                0,
                path,
                address(this),
                block.timestamp + 100
            );

        uint256 amountBNB = amountsNbuBNB[1];
        path[0] = pancakeRouter.WETH();
        path[1] = address(BusdContract);
        uint[] memory amountsBNBBusd = IPancakeRouter(pancakeRouter)
            .swapExactETHForTokens{value: amountBNB}(
            0,
            path,
            address(this),
            block.timestamp + 100
        );
        uint256 amountBusd = amountsBNBBusd[1];
        purchaseRecords[tokenId].amountBusd += amountBusd;

        emit ConfirmOrder(tokenId, amountToSwap, amountBusd, false);
    }

    /**
     * @notice Updates allowed updater
     * @param updater - address of updater
     * @param isActive - boolean of if updater is allowed
     * @dev This method sets some address as true/false for allowing updates in contract
     * Can be executed only by owner
     */
    function updateAllowedUpdater(
        address updater,
        bool isActive
    ) external onlyOwner {
        require(updater != address(0), "Updater address is equal to 0");
        allowedUpdaters[updater] = isActive;
    }

    /**
     * @notice Updates allowed market makers
     * @param marketMaker - address of updater
     * @param isActive - boolean of if updater is allowed
     * @dev This method sets some address as true/false for allowing market makers in contract
     * Can be executed only by owner
     */
    function updateAllowedMarketMakers(
        address marketMaker,
        bool isActive
    ) external onlyOwner {
        require(marketMaker != address(0), "MarketMaker address is equal to 0");
        allowedMarketMakers[marketMaker] = isActive;
    }

    /**
     * @notice Updatesbonus rate
     * @param newRate - new bonus rate
     * @dev This method sets new bonus rate which is important when user burns NFT
     * Can be executed only by owner
     */
    function updateBonusRate(uint256 newRate) external onlyOwner {
        require(
            newRate != bonusRate,
            "New bonus rate should differ from current"
        );
        bonusRate = newRate;

        emit UpdateBonusRate(newRate);
    }

    /**
     * @notice Updates routers
     * @param newNimbusRouter - address of Nimbus Router
     * @param newPancakeRouter - address of Pancake Router
     * @dev This method sets 2 routers for contract parameters
     * Can be executed only by owner
     */
    function updateRouters(
        address newNimbusRouter,
        address newPancakeRouter
    ) external onlyOwner {
        require(
            AddressUpgradeable.isContract(newNimbusRouter),
            "Not a contract"
        );
        require(
            AddressUpgradeable.isContract(newPancakeRouter),
            "Not a contract"
        );
        nimbusRouter = INimbusRouter(newNimbusRouter);
        purchaseToken.approve(newNimbusRouter, type(uint256).max);
        pancakeRouter = IPancakeRouter(newPancakeRouter);

        emit UpdateRouters(newNimbusRouter, newPancakeRouter);
    }

    /**
     * @notice Updates system tokens
     * @param newPurchaseToken - address of Purchase token
     * @param newBUSD - address of BUSD token
     * @dev This method sets 2 system tokens for contract parameters
     * Can be executed only by owner
     */
    function updateTokens(
        address newPurchaseToken,
        address newBUSD
    ) external onlyOwner {
        require(
            AddressUpgradeable.isContract(newPurchaseToken),
            "NFT: purchase token is not a contract"
        );
        require(
            AddressUpgradeable.isContract(newBUSD),
            "NFT: busd token is not a contract"
        );
        purchaseToken = IERC20Upgradeable(newPurchaseToken);
        BusdContract = IERC20Upgradeable(newBUSD);

        emit TokensUpdated(newPurchaseToken, newBUSD);
    }

    function setBaseUri(string memory uri) external onlyOwner {
        baseUri = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    )
        internal
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        onlyOwner
    {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
