// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface INimbusRouter {
    function swapExactTokensForBNB(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function NBU_WBNB() external view returns (address);
}

interface IPancakeRouter {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function WETH() external view returns (address);
}

interface INimbProxy {
    function mint(address receiver, uint256 amount) external;
}

contract APVault is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public maxNimbAmount;
    uint256 public totalNimbSwapped;
    uint256 public totalBusdSent;

    event UpdateRouters(address newNimbusRouter, address newPancakeRouter);
    event TokensUpdated(address purchaseToken, address busd);
    event ReceiveWalletsUpdated(uint256 Index, address newReceiveWallets);

    event ProcessedPayment(
        uint256[] amountToswap,
        uint256 TotalAmount,
        uint256 NimbAmount
    );

    INimbProxy public nimbProxy;
    IERC20Upgradeable public purchaseToken;
    IERC20Upgradeable public BusdContract;
    IERC20Upgradeable[] public ReceiveWallets;
    INimbusRouter public nimbusRouter;
    IPancakeRouter public pancakeRouter;

    mapping(address => bool) public allowedWallets;

    /**
     * @dev Checks if msg.sender is allowed
     */
    modifier onlyAllowed() {
        require(allowedWallets[msg.sender], "Provided address is not allowed");
        _;
    }

    /**
     * @dev This method recieves bnb native coin if msg.sender is Nimbus router or WBNB address
     */
    receive() external payable {
        require(
            msg.sender == nimbusRouter.NBU_WBNB() ||
                msg.sender == address(nimbusRouter),
            "Receiving BNB is not allowed"
        );
    }

    /**
     * @notice Initialize state of contract
     * @param _purchaseToken -NIMB token
     * @param newReceiveWallets - array of receivers
     * @param _busdContract - payment token (BUSD)
     * @param _nimbProxy - proxy address
     * @param newNimbusRouter - nimbus router address
     * @param newPancakeRouter - pancake router address
     * @dev This method sets purchase token, payment token,newReceiveWallets address, proxy address,nimbus router and pancake router
     */
    function initialize(
        address _purchaseToken,
        address _busdContract,
        address[] calldata newReceiveWallets,
        address _nimbProxy,
        address newNimbusRouter,
        address newPancakeRouter
    ) public initializer {
        __Ownable_init();

        _updateTokens(_purchaseToken, _busdContract);
        _updateBUSDreceiveWallets(newReceiveWallets);
        _updateRouters(newNimbusRouter, newPancakeRouter);

        BusdContract = IERC20Upgradeable(_busdContract);
        nimbProxy = INimbProxy(_nimbProxy);

        maxNimbAmount = type(uint256).max;
    }

    /**
     * @notice Update new BUSD receivers wallets
     * @param newReceiveWallets - new  receivers wallets
     * @dev This method sets a new BUSD receivers wallets
     * Can be executed only by owner
     */
    function updateBUSDreceiveWallets(address[] calldata newReceiveWallets)
        external
        onlyOwner
    {
        _updateBUSDreceiveWallets(newReceiveWallets);
    }

    function _updateBUSDreceiveWallets(address[] calldata newReceiveWallets)
        internal
    {
        ReceiveWallets = new IERC20Upgradeable[](newReceiveWallets.length);
        for (uint256 i = 0; i < newReceiveWallets.length; i++) {
            ReceiveWallets[i] = IERC20Upgradeable(newReceiveWallets[i]);
            emit ReceiveWalletsUpdated(i, newReceiveWallets[i]);
        }
    }

    function removeReceiverWallet(uint256 index) external onlyOwner {
        for (uint256 i = index; i < ReceiveWallets.length - 1; i++) {
            ReceiveWallets[i] = ReceiveWallets[i + 1];
        }
        ReceiveWallets.pop();
    }

    function getReceiveWallets() public view returns(IERC20Upgradeable[] memory) {
        return ReceiveWallets;
    }

    /**
     * @notice Update NIMB proxy address
     * @param _nimbProxy - new NIMB proxy address
     * @dev This method set NIMB proxy address
     * Can be executed only by owner
     */
    function updateNimbProxy(address _nimbProxy) external onlyOwner {
        nimbProxy = INimbProxy(_nimbProxy);
    }

    /**
     * @notice Updates max NIMB amount
     * @param _newMaxNimbAmount - new max NIMB amount
     * @dev This method sets new max NIMB amount for swap
     * Can be executed only by owner
     */
    function updateMaxNimbAmount(uint256 _newMaxNimbAmount) external onlyOwner {
        maxNimbAmount = _newMaxNimbAmount;
    }

    /**
     * @notice Updates allowed wallets
     * @param wallet - address of wallet
     * @param isActive - boolean of if wallet is allowed
     * @dev This method sets some addreses as true/false for allowing wallet in contract
     * Can be executed only by owner
     */
    function updateAllowedWallets(address wallet, bool isActive)
        external
        onlyOwner
    {
        require(wallet != address(0), "Wallet address is equal to 0");
        allowedWallets[wallet] = isActive;
    }

    /**
     * @notice Updates routers
     * @param newNimbusRouter - address of Nimbus Router
     * @param newPancakeRouter - address of Pancake Router
     * @dev This method sets 2 routers for contract parameters
     * Can be executed only by owner
     */
    function updateRouters(address newNimbusRouter, address newPancakeRouter)
        external
        onlyOwner
    {
        _updateRouters(newNimbusRouter, newPancakeRouter);
    }

    function _updateRouters(address newNimbusRouter, address newPancakeRouter)
        internal
        onlyOwner
    {
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
    function updateTokens(address newPurchaseToken, address newBUSD)
        external
        onlyOwner
    {
        _updateTokens(newPurchaseToken, newBUSD);
    }

    function _updateTokens(address newPurchaseToken, address newBUSD)
        internal
        onlyOwner
    {
        require(
            AddressUpgradeable.isContract(newPurchaseToken),
            "Purchase token is not a contract"
        );
        require(
            AddressUpgradeable.isContract(newBUSD),
            "Busd token is not a contract"
        );
        purchaseToken = IERC20Upgradeable(newPurchaseToken);
        BusdContract = IERC20Upgradeable(newBUSD);

        emit TokensUpdated(newPurchaseToken, newBUSD);
    }

    /**
     * @param amountBusd - BUSD amount to swap
     * @dev This method use for get NIMB amount for BUSD
     */
    function getNimbAmount(uint256 amountBusd)
        public
        view
        returns (uint256 amountNimb)
    {
        address[] memory path = new address[](2);
        path[0] = pancakeRouter.WETH();
        path[1] = address(BusdContract);
        uint256[] memory amountsBNBBusd = IPancakeRouter(pancakeRouter)
            .getAmountsIn(amountBusd, path);
        uint256 amountBNB = amountsBNBBusd[0];
        path[1] = nimbusRouter.NBU_WBNB();
        path[0] = address(purchaseToken);
        uint256[] memory amountsNimbBNB = INimbusRouter(nimbusRouter)
            .getAmountsIn(amountBNB, path);
        amountNimb = amountsNimbBNB[0];
    }

    /**
     * @notice Auto swap of NIMB via swap machines
     * @param amountToSwap - array of BUSD amounts to swap
     * @dev This method make order swapping NIMB->BUSD using path NIMB->BNB->BUSD after this send tokens to receivers wallets
     * Can be executed only by allowed wallets
     */
    function processPayment(uint256[] memory amountToSwap)
        external
        onlyAllowed
    {
        require(
            amountToSwap.length == ReceiveWallets.length,
            "Amounts must match the number of wallets"
        );

        uint256 TotalAmount = 0;

        for (uint256 i = 0; i < amountToSwap.length; i++) {
            TotalAmount += amountToSwap[i];
        }
        uint256 NimbAmount = getNimbAmount(TotalAmount);
        require(maxNimbAmount >= NimbAmount, "NIMB amount more then allowed");
        nimbProxy.mint(address(this), NimbAmount);
        address[] memory path = new address[](2);
        path[0] = address(purchaseToken);
        path[1] = nimbusRouter.NBU_WBNB();
        uint256[] memory amountsNbuBNB = INimbusRouter(nimbusRouter)
            .swapExactTokensForBNB(
                NimbAmount,
                0,
                path,
                address(this),
                block.timestamp + 100
            );

        uint256 amountBNB = amountsNbuBNB[1];
        path[0] = pancakeRouter.WETH();
        path[1] = address(BusdContract);
        uint256[] memory amountsBNBBusd = IPancakeRouter(pancakeRouter)
            .swapExactETHForTokens{value: amountBNB}(
            0,
            path,
            address(this),
            block.timestamp + 100
        );
        require(amountsBNBBusd[1] >= TotalAmount, "Not enough funds to swap");

        for (uint256 i = 0; i < amountToSwap.length; i++) {
            require(
                address(ReceiveWallets[i]) != address(0),
                "Wallets address is equal to 0"
            );
            BusdContract.safeTransfer(
                address(ReceiveWallets[i]),
                amountToSwap[i]
            );
        }
        totalNimbSwapped += NimbAmount;
        totalBusdSent += TotalAmount;
        emit ProcessedPayment(amountToSwap, TotalAmount, NimbAmount);
    }
}
