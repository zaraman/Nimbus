// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

library TransferHelper {
    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TransferHelper: TRANSFER_FAILED");
    }

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TransferHelper: TRANSFER_FROM_FAILED");
    }

    function safeTransferBNB(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "TransferHelper: BNB_TRANSFER_FAILED");
    }
}

interface IEIP721 {
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

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external;

    event Transfer(address from, address to, uint256 indexed tokenId);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) external returns (bytes4);
}

interface IWBNB {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}

interface IEIP20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

interface IEIP20 {
    function decimals() external returns (uint8);
}

contract NimbusP2P_V2Storage is Initializable, ContextUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    /**
     * @notice TradeSingle srtuct
     * @param initiator  user that create trade
     * @param counterparty user that take trade
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param proposedTokenId
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param askedTokenId
     * @param deadline the expiration date of the trade
     * @param status //0: Active, 1: success, 2: canceled, 3: withdrawn
     * @param isAskedAssetNFT
     * @dev
     */
    struct TradeSingle {
        address initiator;
        address counterparty;
        address proposedAsset;
        uint256 proposedAmount;
        uint256 proposedTokenId;
        address askedAsset;
        uint256 askedAmount;
        uint256 askedTokenId;
        uint256 deadline;
        uint256 status; //0: Active, 1: success, 2: canceled, 3: withdrawn
        bool isAskedAssetNFT;
    }
    /**
     * @notice TradeMulti srtuct
     * @param initiator user that create trade
     * @param counterparty user that take trade
     * @param proposedAssets an array of addresses proposed asset contracts
     * @param proposedAmount an array of proposed amounts
     * @param proposedTokenIds array of ID NFT tokens
     * @param askedAssets an array of addresses asked asset contracts
     * @param askedAmount an array of  asked amounts
     * @param askedTokenIds array of ID NFT tokens
     * @param deadline the expiration date of the trade
     * @param status //0: Active, 1: success, 2: canceled, 3: withdrawn
     * @param isAskedAssetNFT
     * @dev
     */
    struct TradeMulti {
        address initiator;
        address counterparty;
        address[] proposedAssets;
        uint256 proposedAmount;
        uint256[] proposedTokenIds;
        address[] askedAssets;
        uint256[] askedTokenIds;
        uint256 askedAmount;
        uint256 deadline;
        uint256 status; //0: Active, 1: success, 2: canceled, 3: withdrawn
        bool isAskedAssetNFTs;
    }
    /**
     * @notice TradeState enum
     * @param  //0: Active, 1: success, 2: canceled, 3: withdrawn
     * @dev
     */
    enum TradeState {
        Active,
        Succeeded,
        Canceled,
        Withdrawn,
        Overdue
    }

    IWBNB public WBNB;
    uint256 public tradeCount;
    mapping(uint256 => TradeSingle) public tradesSingle;
    mapping(uint256 => TradeMulti) public tradesMulti;
    mapping(address => uint256[]) internal _userTrades;

    mapping(address => bool) public allowedNFT;
    mapping(address => bool) public allowedEIP20;

    event NewTradeSingle(
        address user,
        address proposedAsset,
        uint256 indexed proposedAmount,
        uint256 proposedTokenId,
        address askedAsset,
        uint256 askedAmount,
        uint256 askedTokenId,
        uint256 deadline,
        uint256 indexed tradeId
    );
    event NewTradeMulti(
        address user,
        address[] proposedAssets,
        uint256 proposedAmount,
        uint256[] proposedIds,
        address[] askedAssets,
        uint256 askedAmount,
        uint256[] askedIds,
        uint256 deadline,
        uint256 indexed tradeId
    );
    event SupportTrade(uint256 indexed tradeId, address counterparty);
    event CancelTrade(uint256 indexed tradeId);
    event WithdrawOverdueAsset(uint256 indexed tradeId);
    event UpdateAllowedNFT(address nftContract, bool isAllowed);
    event UpdateAllowedEIP20Tokens(address tokenContract, bool isAllowed);
    event Rescue(address to, uint256 amount);
    event RescueToken(address to, address token, uint256 amount);
}

contract NimbusP2P_V2 is NimbusP2P_V2Storage, IERC721Receiver {
    using AddressUpgradeable for address;

    /**
     * @notice Initialize P2P contract
     * @param _allowedEIP20Tokens array of allowed EIP20 tokens addresses
     * @param _allowedEIP20TokenStates allowed EIP20 token states
     * @param _allowedNFTTokens array of allowed NFT tokens addresses
     * @param _allowedNFTTokenStates allowed NFT token states
     * @param _WBNB WBNB address
     * @dev OpenZeppelin initializer ensures this can only be called once
     * This function also calls initializers on inherited contracts
     */
    function initialize(
        address[] calldata _allowedEIP20Tokens,
        bool[] calldata _allowedEIP20TokenStates,
        address[] calldata _allowedNFTTokens,
        bool[] calldata _allowedNFTTokenStates,
        address _WBNB
    ) public initializer {
        require(_WBNB != address(0), "WBNB address should not be zero");

        __Context_init();
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        WBNB = IWBNB(_WBNB);
        _updateAllowedEIP20Tokens(_allowedEIP20Tokens, _allowedEIP20TokenStates);
        _updateAllowedNFTs(_allowedNFTTokens, _allowedNFTTokenStates);
    }

    receive() external payable {
        require(msg.sender == address(WBNB), "Only accept ETH via fallback from the WBNB contract");
    }

    /**
     * @notice Sets Contract as paused
     * @param isPaused  Pausable mode
     */
    function setPaused(bool isPaused) external onlyOwner {
        if (isPaused) _pause();
        else _unpause();
    }

    /**
     * @notice Creates EIP20 to EIP20 trade
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param deadline  the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of tokens BEP20 standard. 
        You can only exchange tokens allowed on the platform.
     */
    function createTradeEIP20ToEIP20(
        address proposedAsset,
        uint256 proposedAmount,
        address askedAsset,
        uint256 askedAmount,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset) && AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0 && IEIP20(askedAsset).decimals() > 0, "NimbusP2P_V2: Propossed and Asked assets are not an EIP20 tokens");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedEIP20(proposedAsset);
        _requireAllowedEIP20(askedAsset);
        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);
        tradeId = _createTradeSingle(proposedAsset, proposedAmount, 0, askedAsset, askedAmount, 0, deadline, false);
    }

    /**
     * @notice Creates BNB to EIP20 trade
     * @param askedAsset proposed asset contract address
     * @param askedAmount proposed amount
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a BNB trade for EIP20 tokens. 
        ProposedAmount is passed in block msg.value
        for trade EIP20 > Native Coin use createTradeEIP20ToEIP20 and pass WBNB address as asked asset
     */
    function createTradeBNBtoEIP20(
        address askedAsset,
        uint256 askedAmount,
        uint256 deadline
    ) external payable returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contract");
        require(IEIP20(askedAsset).decimals() > 0, "NimbusP2P_V2: Asked asset are not an EIP20 token");
        require(msg.value > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedEIP20(askedAsset);
        WBNB.deposit{value: msg.value}();
        tradeId = _createTradeSingle(address(WBNB), msg.value, 0, askedAsset, askedAmount, 0, deadline, false);
    }

    /**
     * @notice Creates EIP20 to NFT trade
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAsset asked asset contract address
     * @param tokenId  unique NFT token identifier
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of tokens BEP20 standard for tokens EIP721 standart. 
        You can only exchange tokens allowed on the platform.
     */
    function createTradeEIP20ToNFT(
        address proposedAsset,
        uint256 proposedAmount,
        address askedAsset,
        uint256 tokenId,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset) && AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0, "NimbusP2P_V2: Propossed asset are not an EIP20 token");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedEIP20(proposedAsset);
        _requireAllowedNFT(askedAsset);
        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);
        tradeId = _createTradeSingle(proposedAsset, proposedAmount, 0, askedAsset, 0, tokenId, deadline, true);
    }

    /**
     * @notice Creates NFT to EIP20 trade
     * @param proposedAsset proposed asset contract address
     * @param tokenId  unique NFT token identifier
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of tokens EIP721 standard for EIP20.
        for trade NFT > Native Coin use createTradeNFTtoEIP20 and pass WBNB address as asked asset
     */
    function createTradeNFTtoEIP20(
        address proposedAsset,
        uint256 tokenId,
        address askedAsset,
        uint256 askedAmount,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset) && AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(askedAsset).decimals() > 0, "NimbusP2P_V2: Asked asset are not an EIP20 token");
        _requireAllowedNFT(proposedAsset);
        _requireAllowedEIP20(askedAsset);
        IEIP721(proposedAsset).safeTransferFrom(msg.sender, address(this), tokenId);
        tradeId = _createTradeSingle(proposedAsset, 0, tokenId, askedAsset, askedAmount, 0, deadline, false);
    }

    /**
     * @notice Creates BNB to NFT trade
     * @param askedAsset asked asset contract address
     * @param tokenId unique NFT token identifier
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange BNB for EIP20 tokens. 
        ProposedAmount is passed in block msg.value
     */
    function createTradeBNBtoNFT(
        address askedAsset,
        uint256 tokenId,
        uint256 deadline
    ) external payable returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contract");
        require(msg.value > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedNFT(askedAsset);
        WBNB.deposit{value: msg.value}();
        tradeId = _createTradeSingle(address(WBNB), msg.value, 0, askedAsset, 0, tokenId, deadline, true);
    }

    /**
     * @notice Creates EIP20 to NFTs multi trade
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAssets an array of addresses asked asset contracts
     * @param askedTokenIds array of ID NFT tokens
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of tokens EIP20 standard for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on.
     */
    function createTradeEIP20ToNFTs(
        address proposedAsset,
        uint256 proposedAmount,
        address[] memory askedAssets,
        uint256[] memory askedTokenIds,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0, "NimbusP2P_V2: Propossed asset are not an EIP20 token");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        require(askedAssets.length > 0, "NimbusP2P_V2: askedAssets empty");
        require(askedAssets.length == askedTokenIds.length, "NimbusP2P_V2: Wrong lengths");
        _requireAllowedEIP20(proposedAsset);
        for (uint256 i = 0; i < askedAssets.length; ) {
            require(AddressUpgradeable.isContract(askedAssets[i]));
            _requireAllowedNFT(askedAssets[i]);

            unchecked {
                ++i;
            }
        }

        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);

        address[] memory proposedAssets = new address[](1);
        proposedAssets[0] = proposedAsset;
        uint256[] memory proposedIds = new uint256[](0);
        tradeId = _createTradeMulti(proposedAssets, proposedAmount, proposedIds, askedAssets, 0, askedTokenIds, deadline, true);
    }

    /**
     * @notice Creates NFTs to EIP20 multi trade
     * @param proposedAssets an array of addresses proposed asset contracts
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param proposedTokenIds asked tokens
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of any number of tokens EIP721 standard for EIP20 tokens. 
        Elements in the arrays proposedAssets and proposedAmounts must have the same indexes. 
        The first element of the proposedAssets array must match the first element of the proposedAmounts array and so on.
        for trade NFTs > Native Coin use createTradeNFTstoEIP20 and pass WBNB address as asked asset
     */
    function createTradeNFTsToEIP20(
        address[] memory proposedAssets,
        uint256[] memory proposedTokenIds,
        address askedAsset,
        uint256 askedAmount,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(askedAsset).decimals() > 0, "NimbusP2P_V2: Asked asset are not an EIP20 token");
        require(proposedAssets.length == proposedTokenIds.length, "NimbusP2P_V2: Wrong lengths");
        require(proposedAssets.length > 0, "NimbusP2P_V2: proposedAssets empty");
        _requireAllowedEIP20(askedAsset);
        for (uint256 i = 0; i < proposedAssets.length; ) {
            require(AddressUpgradeable.isContract(proposedAssets[i]), "NimbusP2P_V2: Not contracts");
            _requireAllowedNFT(proposedAssets[i]);
            IEIP721(proposedAssets[i]).safeTransferFrom(msg.sender, address(this), proposedTokenIds[i]);
            unchecked {
                ++i;
            }
        }
        address[] memory askedAssets = new address[](1);
        askedAssets[0] = askedAsset;
        uint256[] memory askedIds = new uint256[](0);
        tradeId = _createTradeMulti(proposedAssets, 0, proposedTokenIds, askedAssets, askedAmount, askedIds, deadline, false);
    }

    /**
     * @notice Creates BNB to NFTs multi trade
     * @param askedAssets an array of addresses asked asset contracts
     * @param askedTokenIds array of ID NFT tokens
     * @param deadline the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of BNB (Native chain coin) for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on.
     */
    function createTradeBNBtoNFTs(
        address[] memory askedAssets,
        uint256[] memory askedTokenIds,
        uint256 deadline
    ) external payable returns (uint256 tradeId) {
        require(askedAssets.length == askedTokenIds.length, "NimbusP2P_V2: Wrong lengths");
        require(msg.value > 0, "NimbusP2P_V2: Zero amount not allowed");
        require(askedAssets.length > 0, "NimbusP2P_V2: askedAssets empty!");
        for (uint256 i = 0; i < askedAssets.length; ) {
            require(AddressUpgradeable.isContract(askedAssets[i]), "NimbusP2P_V2: Not contracts");
            _requireAllowedNFT(askedAssets[i]);
            unchecked {
                ++i;
            }
        }
        require(msg.value > 0);
        WBNB.deposit{value: msg.value}();
        address[] memory proposedAssets = new address[](1);
        proposedAssets[0] = address(WBNB);
        uint256[] memory proposedIds = new uint256[](0);
        tradeId = _createTradeMulti(proposedAssets, msg.value, proposedIds, askedAssets, 0, askedTokenIds, deadline, true);
    }

    /**
     * @notice Creates NFTs to EIP20 multi trade
     * @param proposedAssets an array of addresses proposed asset contracts
     * @param proposedTokenIds array of ID NFT tokens
     * @param askedAssets an array of addresses asked asset contracts
     * @param askedTokenIds array of ID NFT tokens
     * @param deadline  the expiration date of the trade
     * @dev This method makes it possible to create a trade for the exchange of any number of tokens EIP721 standard for any number of tokens EIP721 standard. 
        Elements in the arrays proposedAssets and proposedAmounts must have the same indexes. 
        The first element of the proposedAssets array must match the first element of the proposedAmounts array and so on.
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on.
     */
    function createTradeNFTsToNFTs(
        address[] memory proposedAssets,
        uint256[] memory proposedTokenIds,
        address[] memory askedAssets,
        uint256[] memory askedTokenIds,
        uint256 deadline
    ) external returns (uint256 tradeId) {
        require(askedAssets.length > 0, "NimbusP2P_V2: askedAssets empty!");
        require(proposedAssets.length > 0, "NimbusP2P_V2: proposedAssets empty!");
        require(proposedAssets.length == proposedTokenIds.length, "NimbusP2P_V2: AskedAssets wrong lengths");
        require(askedAssets.length == askedTokenIds.length, "NimbusP2P_V2: AskedAssets wrong lengths");
        for (uint256 i = 0; i < askedAssets.length; ) {
            require(AddressUpgradeable.isContract(askedAssets[i]), "NimbusP2P_V2: Not contracts");
            _requireAllowedNFT(askedAssets[i]);
            unchecked {
                ++i;
            }
        }

        for (uint256 i = 0; i < proposedAssets.length; ) {
            require(AddressUpgradeable.isContract(proposedAssets[i]), "NimbusP2P_V2: Not contracts");
            _requireAllowedNFT(proposedAssets[i]);
            IEIP721(proposedAssets[i]).safeTransferFrom(msg.sender, address(this), proposedTokenIds[i]);
            unchecked {
                ++i;
            }
        }
        tradeId = _createTradeMulti(proposedAssets, 0, proposedTokenIds, askedAssets, 0, askedTokenIds, deadline, true);
    }

    /**
     * @notice Creates EIP20 to EIP20 trade with Permit
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param deadline the expiration date of the trade
     * @param permitDeadline  the expiration date of the permit
     * @param v the recovery id
     * @param r outputs of an ECDSA signature
     * @param s outputs of an ECDSA signature
     * @dev This method makes it possible to create  trade for the exchange of tokens BEP20 standard. 
        You can only exchange tokens allowed on the platform.
     */
    function createTradeEIP20ToEIP20Permit(
        address proposedAsset,
        uint256 proposedAmount,
        address askedAsset,
        uint256 askedAmount,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset) && AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0 && IEIP20(askedAsset).decimals() > 0, "NimbusP2P_V2: Propossed and Asked assets are not an EIP20 tokens");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedEIP20(askedAsset);
        _requireAllowedEIP20(proposedAsset);
        IEIP20Permit(proposedAsset).permit(msg.sender, address(this), proposedAmount, permitDeadline, v, r, s);
        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);
        tradeId = _createTradeSingle(proposedAsset, proposedAmount, 0, askedAsset, askedAmount, 0, deadline, false);
    }

    /**
     * @notice Creates EIP20 to NFT trade with Permit
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAsset asked asset contract address
     * @param tokenId unique NFT token identifier
     * @param deadline the expiration date of the trade
     * @param permitDeadline the expiration date of the permit
     * @param v the recovery id
     * @param r outputs of an ECDSA signature
     * @param s outputs of an ECDSA signature
     * @dev This method makes it possible to create a trade for the exchange of tokens BEP20 standard for tokens EIP721 standart. 
        You can only exchange tokens allowed on the platform.
     */
    function createTradeEIP20ToNFTPermit(
        address proposedAsset,
        uint256 proposedAmount,
        address askedAsset,
        uint256 tokenId,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset) && AddressUpgradeable.isContract(askedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0, "NimbusP2P_V2: Propossed asset are not an EIP20 token");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        _requireAllowedEIP20(proposedAsset);
        _requireAllowedNFT(askedAsset);
        IEIP20Permit(proposedAsset).permit(msg.sender, address(this), proposedAmount, permitDeadline, v, r, s);
        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);
        tradeId = _createTradeSingle(proposedAsset, proposedAmount, 0, askedAsset, 0, tokenId, deadline, true);
    }

    /**
     * @notice Creates EIP20 to NFTs multi trade with Permit
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param askedAssets an array of addresses asked asset contracts
     * @param askedTokenIds array of ID NFT tokens
     * @param deadline the expiration date of the trade
     * @param permitDeadline the expiration date of the permit
     * @param v the recovery id
     * @param r outputs of an ECDSA signature
     * @param s outputs of an ECDSA signature
     * @dev This method makes it possible to create a trade for the exchange of tokens EIP20 standard for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on.
     */
    function createTradeEIP20ToNFTsPermit(
        address proposedAsset,
        uint256 proposedAmount,
        address[] memory askedAssets,
        uint256[] memory askedTokenIds,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 tradeId) {
        require(AddressUpgradeable.isContract(proposedAsset), "NimbusP2P_V2: Not contracts");
        require(IEIP20(proposedAsset).decimals() > 0, "NimbusP2P_V2: Propossed  asset are not an EIP20 token");
        require(proposedAmount > 0, "NimbusP2P_V2: Zero amount not allowed");
        require(askedAssets.length == askedTokenIds.length, "NimbusP2P_V2: Wrong lengths");

        for (uint256 i = 0; i < askedAssets.length; ) {
            require(AddressUpgradeable.isContract(askedAssets[i]));
            _requireAllowedNFT(askedAssets[i]);
            unchecked {
                ++i;
            }
        }

        _requireAllowedEIP20(proposedAsset);
        IEIP20Permit(proposedAsset).permit(msg.sender, address(this), proposedAmount, permitDeadline, v, r, s);
        TransferHelper.safeTransferFrom(proposedAsset, msg.sender, address(this), proposedAmount);

        address[] memory proposedAssets = new address[](1);
        proposedAssets[0] = proposedAsset;
        uint256[] memory proposedIds = new uint256[](0);
        tradeId = _createTradeMulti(proposedAssets, proposedAmount, proposedIds, askedAssets, 0, askedTokenIds, deadline, true);
    }

    /**
     * @notice Matches the trade by its id
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades.
     */
    function supportTradeSingle(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeSingle storage trade = tradesSingle[tradeId];
        require(trade.status == 0 && trade.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");

        if (trade.isAskedAssetNFT) {
            IEIP721(trade.askedAsset).safeTransferFrom(msg.sender, trade.initiator, trade.askedTokenId);
        } else {
            TransferHelper.safeTransferFrom(trade.askedAsset, msg.sender, trade.initiator, trade.askedAmount);
        }
        _supportTradeSingle(tradeId);
    }

    /**
     * @notice Matches the trade by its id
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the BNB on a wallet of the creator of trade is sent.
        This is a method of supporting single trades.
     */
    function supportTradeSingleBNB(uint256 tradeId) external payable nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeSingle storage trade = tradesSingle[tradeId];
        require(trade.status == 0 && trade.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");
        require(msg.value >= trade.askedAmount, "NimbusP2P_V2: Not enough BNB sent");
        require(trade.askedAsset == address(WBNB), "NimbusP2P_V2: BEP20 trade");

        TransferHelper.safeTransferBNB(trade.initiator, trade.askedAmount);
        if (msg.value > trade.askedAmount) TransferHelper.safeTransferBNB(msg.sender, msg.value - trade.askedAmount);
        _supportTradeSingle(tradeId);
    }

    /**
     * @notice Matches the single trade by its id (with Permit)
     * @param tradeId unique trade identifier
     * @param permitDeadline the expiration date of the permit
     * @param v the recovery id
     * @param r outputs of an ECDSA signature
     * @param s outputs of an ECDSA signature
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades.
     */
    function supportTradeSingleWithPermit(
        uint256 tradeId,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusBEP20P2P_V1: Invalid trade id");
        TradeSingle storage trade = tradesSingle[tradeId];
        require(!trade.isAskedAssetNFT, "NimbusBEP20P2P_V1: Permit only allowed for EIP20 tokens");
        require(trade.status == 0 && trade.deadline > block.timestamp, "NimbusBEP20P2P_V1: Not active trade");

        IEIP20Permit(trade.askedAsset).permit(msg.sender, address(this), trade.askedAmount, permitDeadline, v, r, s);
        TransferHelper.safeTransferFrom(trade.askedAsset, msg.sender, trade.initiator, trade.askedAmount);
        _supportTradeSingle(tradeId);
    }

    /**
     * @notice Matches the multi trade by its id
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades.
     */
    function supportTradeMulti(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        require(tradeMulti.status == 0 && tradeMulti.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");
        if (tradeMulti.isAskedAssetNFTs) {
            for (uint256 i = 0; i < tradeMulti.askedAssets.length; ) {
                IEIP721(tradeMulti.askedAssets[i]).safeTransferFrom(msg.sender, tradeMulti.initiator, tradeMulti.askedTokenIds[i]);
                unchecked {
                    ++i;
                }
            }
        } else {
            TransferHelper.safeTransferFrom(tradeMulti.askedAssets[0], msg.sender, tradeMulti.initiator, tradeMulti.askedAmount);
        }

        _supportTradeMulti(tradeId);
    }

    /**
     * @notice Matches the multi trade by its id (with Permit)
     * @param tradeId unique trade identifier
     * @param permitDeadline the expiration date of the permit
     * @param v the recovery id
     * @param r outputs of an ECDSA signature
     * @param s outputs of an ECDSA signature
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades.
     */
    function supportTradeMultiWithPermit(
        uint256 tradeId,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        require(!tradeMulti.isAskedAssetNFTs, "NimbusP2P_V2: Only EIP20 supported");
        require(tradeMulti.status == 0 && tradeMulti.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");

        for (uint256 i = 0; i < tradeMulti.askedAssets.length; ) {
            IEIP20Permit(tradeMulti.askedAssets[i]).permit(msg.sender, address(this), tradeMulti.askedAmount, permitDeadline, v, r, s);
            TransferHelper.safeTransferFrom(tradeMulti.askedAssets[i], msg.sender, tradeMulti.initiator, tradeMulti.askedAmount);

            unchecked {
                ++i;
            }
        }

        _supportTradeMulti(tradeId);
    }

    /**
     * @notice Cancels the trade by its id
     * @param tradeId unique trade identifier
     * @dev This method takes tradeId and cancels the thread before the deadline. As a result of his work, the proposed assets are returned to the wallet of the creator of the trade
        This is a method of canceling single trades.
     */
    function cancelTrade(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeSingle storage trade = tradesSingle[tradeId];
        require(trade.initiator == msg.sender, "NimbusP2P_V2: Not allowed");
        require(trade.status == 0 && trade.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");

        if (trade.proposedAmount == 0) {
            IEIP721(trade.proposedAsset).transferFrom(address(this), msg.sender, trade.proposedTokenId);
        } else if (trade.proposedAsset != address(WBNB)) {
            TransferHelper.safeTransfer(trade.proposedAsset, msg.sender, trade.proposedAmount);
        } else {
            WBNB.withdraw(trade.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, trade.proposedAmount);
        }

        trade.status = 2;
        emit CancelTrade(tradeId);
    }

    /**
     * @notice Cancels the trade by its id
     * @param tradeId unique trade identifier
     * @dev This method takes tradeId and cancels the thread before the deadline. As a result of his work, the proposed assets are returned to the wallet of the creator of the trade
        This is a method of canceling multi trades.
     */
    function cancelTradeMulti(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        require(tradeMulti.initiator == msg.sender, "NimbusP2P_V2: Not allowed");
        require(tradeMulti.status == 0 && tradeMulti.deadline > block.timestamp, "NimbusP2P_V2: Not active trade");

        if (tradeMulti.proposedAmount == 0) {
            for (uint256 i = 0; i < tradeMulti.proposedAssets.length; ) {
                IEIP721(tradeMulti.proposedAssets[i]).transferFrom(address(this), msg.sender, tradeMulti.proposedTokenIds[i]);
                unchecked {
                    ++i;
                }
            }
        } else if (tradeMulti.proposedAssets[0] != address(WBNB)) {
            TransferHelper.safeTransfer(tradeMulti.proposedAssets[0], msg.sender, tradeMulti.proposedAmount);
        } else {
            WBNB.withdraw(tradeMulti.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, tradeMulti.proposedAmount);
        }

        tradeMulti.status = 2;
        emit CancelTrade(tradeId);
    }

    /**
     * @notice Withdraws asset of the particular trade by its id when trade is overdue
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and withdraws the proposed assets from the P2P contract after the trade deadline has expired. 
        As a result of his work, the proposed assets are returned to the wallet of the creator of the trade.
     */
    function withdrawOverdueAssetSingle(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeSingle storage trade = tradesSingle[tradeId];
        require(trade.initiator == msg.sender, "NimbusP2P_V2: Not allowed");
        require(trade.status == 0 && trade.deadline < block.timestamp, "NimbusP2P_V2: Not available for withdrawal");
        emit WithdrawOverdueAsset(tradeId);
        if (trade.proposedAmount == 0) {
            IEIP721(trade.proposedAsset).transferFrom(address(this), msg.sender, trade.proposedTokenId);
        } else if (trade.proposedAsset != address(WBNB)) {
            TransferHelper.safeTransfer(trade.proposedAsset, msg.sender, trade.proposedAmount);
        } else {
            WBNB.withdraw(trade.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, trade.proposedAmount);
        }

        trade.status = 3;
    }

    /**
     * @notice Withdraws asset of the particular trade by its id when trade is overdue
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and withdraws the proposed assets from the P2P contract after the trade deadline has expired. 
        As a result of his work, the proposed assets are returned to the wallet of the creator of the trade.
     */
    function withdrawOverdueAssetsMulti(uint256 tradeId) external nonReentrant whenNotPaused {
        require(tradeCount >= tradeId && tradeId > 0, "NimbusP2P_V2: Invalid trade id");
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        require(tradeMulti.initiator == msg.sender, "NimbusP2P_V2: Not allowed");
        require(tradeMulti.status == 0 && tradeMulti.deadline < block.timestamp, "NimbusP2P_V2: Not available for withdrawal");
        emit WithdrawOverdueAsset(tradeId);
        if (tradeMulti.proposedAmount == 0) {
            for (uint256 i = 0; i < tradeMulti.proposedAssets.length; ) {
                IEIP721(tradeMulti.proposedAssets[i]).transferFrom(address(this), msg.sender, tradeMulti.proposedTokenIds[i]);
                unchecked {
                    ++i;
                }
            }
        } else if (tradeMulti.proposedAssets[0] != address(WBNB)) {
            TransferHelper.safeTransfer(tradeMulti.proposedAssets[0], msg.sender, tradeMulti.proposedAmount);
        } else {
            WBNB.withdraw(tradeMulti.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, tradeMulti.proposedAmount);
        }

        tradeMulti.status = 3;
    }

    /**
     * @notice allows particular EIP20 tokens for new trades
     * @param tokens addresses of tokens
     * @param states booleans (is Allowed)
     * @dev This method allows the particular EIP20 tokens contracts to be passed as proposed or asked assets for new trades
     */
    function updateAllowedEIP20Tokens(address[] calldata tokens, bool[] calldata states) external onlyOwner {
        _updateAllowedEIP20Tokens(tokens, states);
    }

    /**
     * @notice Rescues particular EIP20 token`s amount from contract to some address
     * @param to  address of recepient
     * @param tokenAddress address of token
     * @param amount  amount of token to be withdraw
     */
    function rescueEIP20(
        address to,
        address tokenAddress,
        uint256 amount
    ) external onlyOwner whenPaused {
        require(to != address(0), "NimbusP2P_V2: Cannot rescue to the zero address");
        require(amount > 0, "NimbusP2P_V2: Cannot rescue 0");
        emit RescueToken(to, address(tokenAddress), amount);
        TransferHelper.safeTransfer(tokenAddress, to, amount);
    }

    /**
     * @notice Rescues particular NFT by Id from contract to some address
     * @param to address of recepient
     * @param tokenAddress address of NFT
     * @param tokenId id of token to be withdraw
     */
    function rescueEIP721(
        address to,
        address tokenAddress,
        uint256 tokenId
    ) external onlyOwner whenPaused {
        require(to != address(0), "NimbusP2P_V2: Cannot rescue to the zero address");
        emit RescueToken(to, address(tokenAddress), tokenId);
        IEIP721(tokenAddress).safeTransferFrom(address(this), to, tokenId);
    }

    /**
     * @notice allows particular NFT for new trades
     * @param nft address of NFT
     * @param isAllowed boolean (is Allowed)
     * @dev This method allows the particular NFT contract to be passed as proposed or asked assets for new trades
     */
    function updateAllowedNFT(address nft, bool isAllowed) external onlyOwner {
        _updateAllowedNFT(nft, isAllowed);
    }

    /**
     * @notice return the State of given multi trade by id
     * @param id unique trade identifier
     */
    function getTradeMulti(uint256 id) external view returns (TradeMulti memory) {
        return tradesMulti[id];
    }

    /**
     * @notice return whether State of Single trade is active
     * @param tradeId unique trade identifier
     */
    function state(uint256 tradeId) external view returns (TradeState) {
        //TODO
        TradeSingle storage trade = tradesSingle[tradeId];
        require(tradeCount >= tradeId && tradeId > 0 && trade.deadline > 0, "NimbusP2P_V2: Invalid trade id");
        if (trade.status == 1) {
            return TradeState.Succeeded;
        } else if (trade.status == 2 || trade.status == 3) {
            return TradeState(trade.status);
        } else if (trade.deadline < block.timestamp) {
            return TradeState.Overdue;
        } else {
            return TradeState.Active;
        }
    }

    /**
     * @notice return whether State of Multi trade is active
     * @param tradeId unique trade identifier
     */
    function stateMulti(uint256 tradeId) external view returns (TradeState) {
        //TODO
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        require(tradeCount >= tradeId && tradeId > 0 && tradeMulti.deadline > 0, "NimbusP2P_V2: Invalid trade id");

        if (tradeMulti.status == 1) {
            return TradeState.Succeeded;
        } else if (tradeMulti.status == 2 || tradeMulti.status == 3) {
            return TradeState(tradeMulti.status);
        } else if (tradeMulti.deadline < block.timestamp) {
            return TradeState.Overdue;
        } else {
            return TradeState.Active;
        }
    }

    /**
     * @notice return returns the array of user`s trades Ids
     * @param user user address
     */
    function userTrades(address user) external view returns (uint256[] memory) {
        return _userTrades[user];
    }

    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) external pure override returns (bytes4) {
        return 0x150b7a02;
    }

    /**
     * @notice requires NFT to be allowed
     * @param nftContract nftContract address to check for allowance
     */
    function _requireAllowedNFT(address nftContract) private view {
        require(allowedNFT[nftContract], "NimbusP2P_V2: Not allowed NFT");
    }

    /**
     * @notice requires EIP20 token to be allowed
     * @param tokenContract  tokenContract to check for allowance
     */
    function _requireAllowedEIP20(address tokenContract) private view {
        require(allowedEIP20[tokenContract], "NimbusP2P_V2: Not allowed EIP20 Token");
    }

    /**
     * @notice Creates new trade
     * @param proposedAsset proposed asset contract address
     * @param proposedAmount proposed amount
     * @param proposedTokenId proposed asset token Id
     * @param askedAsset asked asset contract address
     * @param askedAmount asked amount
     * @param askedTokenId asked asset token Id
     * @param deadline the expiration date of the trade
     * @param isNFTAskedAsset whether asked asset is NFT
     * @dev This method makes it possible to create a trade.
        You can only exchange tokens allowed on the platform.
     */
    function _createTradeSingle(
        address proposedAsset,
        uint256 proposedAmount,
        uint256 proposedTokenId,
        address askedAsset,
        uint256 askedAmount,
        uint256 askedTokenId,
        uint256 deadline,
        bool isNFTAskedAsset
    ) private whenNotPaused returns (uint256 tradeId) {
        require(deadline > block.timestamp, "NimbusP2P_V2: Incorrect deadline");
        require(askedAsset != proposedAsset, "NimbusP2P_V2: Asked asset can't be equal to proposed asset");

        tradeId = ++tradeCount;

        TradeSingle storage trade = tradesSingle[tradeId];
        trade.initiator = msg.sender;
        trade.proposedAsset = proposedAsset;
        if (proposedAmount > 0) trade.proposedAmount = proposedAmount;
        if (proposedTokenId > 0) trade.proposedTokenId = proposedTokenId;
        trade.askedAsset = askedAsset;
        if (askedAmount > 0) trade.askedAmount = askedAmount;
        if (askedTokenId > 0) trade.askedTokenId = askedTokenId;
        trade.deadline = deadline;
        if (isNFTAskedAsset) trade.isAskedAssetNFT = true;
        emit NewTradeSingle(msg.sender, proposedAsset, proposedAmount, proposedTokenId, askedAsset, askedAmount, askedTokenId, deadline, tradeId);
        _userTrades[msg.sender].push(tradeId);
    }

    /**
     * @notice Creates new trade
     * @param proposedAssets proposed assets contract addresses
     * @param proposedAmount proposed amount
     * @param proposedTokenIds proposed assets token Ids
     * @param askedAssets asked assets contract addresses
     * @param askedAmount asked amount
     * @param askedTokenIds asked assets token Ids
     * @param deadline the expiration date of the trade
     * @param isNFTsAskedAsset  whether asked asset is NFT
     * @dev This method makes it possible to create a trade.
        You can only exchange tokens allowed on the platform.
     */
    function _createTradeMulti(
        address[] memory proposedAssets,
        uint256 proposedAmount,
        uint256[] memory proposedTokenIds,
        address[] memory askedAssets,
        uint256 askedAmount,
        uint256[] memory askedTokenIds,
        uint256 deadline,
        bool isNFTsAskedAsset
    ) private whenNotPaused returns (uint256 tradeId) {
        require(deadline > block.timestamp, "NimbusP2P_V2: Incorrect deadline");

        if (askedTokenIds.length > 0 && proposedTokenIds.length > 0) {
            for (uint256 i = 0; i < askedAssets.length; ) {
                for (uint256 j = 0; j < proposedAssets.length; ) {
                    if (askedTokenIds[i] == proposedTokenIds[j]) {
                        require(askedAssets[i] != proposedAssets[j], "NimbusP2P_V2: Asked asset can't be equal to proposed asset");
                    }
                    unchecked {
                        ++j;
                    }
                }
                unchecked {
                    ++i;
                }
            }
        }

        tradeId = ++tradeCount;

        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        tradeMulti.initiator = msg.sender;
        tradeMulti.proposedAssets = proposedAssets;
        if (proposedAmount > 0) tradeMulti.proposedAmount = proposedAmount;
        if (proposedTokenIds.length > 0) tradeMulti.proposedTokenIds = proposedTokenIds;
        tradeMulti.askedAssets = askedAssets;
        if (askedAmount > 0) tradeMulti.askedAmount = askedAmount;
        if (askedTokenIds.length > 0) tradeMulti.askedTokenIds = askedTokenIds;
        tradeMulti.deadline = deadline;
        if (isNFTsAskedAsset) tradeMulti.isAskedAssetNFTs = true;

        emit NewTradeMulti(msg.sender, proposedAssets, proposedAmount, proposedTokenIds, askedAssets, askedAmount, askedTokenIds, deadline, tradeId);
        _userTrades[msg.sender].push(tradeId);
    }

    /**
     * @notice Matches the trade by its id
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades.
     */
    function _supportTradeSingle(uint256 tradeId) private whenNotPaused {
        TradeSingle memory trade = tradesSingle[tradeId];
        emit SupportTrade(tradeId, msg.sender);
        if (trade.proposedAmount == 0) {
            IEIP721(trade.proposedAsset).transferFrom(address(this), msg.sender, trade.proposedTokenId);
        } else if (trade.proposedAsset != address(WBNB)) {
            TransferHelper.safeTransfer(trade.proposedAsset, msg.sender, trade.proposedAmount);
        } else {
            WBNB.withdraw(trade.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, trade.proposedAmount);
        }

        tradesSingle[tradeId].counterparty = msg.sender;
        tradesSingle[tradeId].status = 1;
    }

    /**
     * @notice Matches the multi trade by its id
     * @param tradeId unique trade identifier
     * @dev This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades.
     */
    function _supportTradeMulti(uint256 tradeId) private whenNotPaused {
        TradeMulti memory tradeMulti = tradesMulti[tradeId];
        emit SupportTrade(tradeId, msg.sender);
        if (tradeMulti.proposedAmount == 0) {
            for (uint256 i = 0; i < tradeMulti.proposedAssets.length; ) {
                IEIP721(tradeMulti.proposedAssets[i]).transferFrom(address(this), msg.sender, tradeMulti.proposedTokenIds[i]);
                unchecked {
                    ++i;
                }
            }
        } else if (tradeMulti.proposedAssets[0] != address(WBNB)) {
            TransferHelper.safeTransfer(tradeMulti.proposedAssets[0], msg.sender, tradeMulti.proposedAmount);
        } else {
            WBNB.withdraw(tradeMulti.proposedAmount);
            TransferHelper.safeTransferBNB(msg.sender, tradeMulti.proposedAmount);
        }

        tradesMulti[tradeId].counterparty = msg.sender;
        tradesMulti[tradeId].status = 1;
    }

    /**
     * @notice allows particular NFT for new trades
     * @param nft address of NFT
     * @param isAllowed  boolean (is Allowed)
     * @dev This method allows the particular NFT contract to be passed as proposed or asked assets for new trades
     */
    function _updateAllowedNFT(address nft, bool isAllowed) private {
        require(AddressUpgradeable.isContract(nft), "NimbusP2P_V2: Not a contract");
        allowedNFT[nft] = isAllowed;
        emit UpdateAllowedNFT(nft, isAllowed);
    }

    /**
     * @notice allows particular NFTs for new trades
     * @param nfts addresses of NFTs
     * @param states booleans (is Allowed)
     * @dev This method allows the particular NFTs contracts to be passed as proposed or asked assets for new trades
     */
    function _updateAllowedNFTs(address[] calldata nfts, bool[] calldata states) private {
        require(nfts.length == states.length, "NimbusP2P_V2: Length mismatch");

        for (uint i = 0; i < nfts.length; ) {
            _updateAllowedNFT(nfts[i], states[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice allows particular EIP20 token contract for new trades
     * @param token address of token
     * @param isAllowed boolean (is Allowed)
     * @dev This method allows the particular EIP20 contract to be passed as proposed or asked assets for new trades
     */
    function _updateAllowedEIP20Token(address token, bool isAllowed) private {
        require(AddressUpgradeable.isContract(token), "NimbusP2P_V2: Not a contract");
        allowedEIP20[token] = isAllowed;
        emit UpdateAllowedEIP20Tokens(token, isAllowed);
    }

    /**
     * @notice allows particular EIP20 tokens for new trades
     * @param tokens addresses of tokens
     * @param states booleans (is Allowed)
     * @dev This method allows the particular EIP20 tokens contracts to be passed as proposed or asked assets for new trades
     */
    function _updateAllowedEIP20Tokens(address[] calldata tokens, bool[] calldata states) private {
        require(tokens.length == states.length, "NimbusP2P_V2: Length mismatch");

        for (uint256 i = 0; i < tokens.length; ) {
            _updateAllowedEIP20Token(tokens[i], states[i]);
            unchecked {
                ++i;
            }
        }
    }
}
