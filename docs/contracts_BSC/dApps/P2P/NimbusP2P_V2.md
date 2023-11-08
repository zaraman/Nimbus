# Solidity API

## TransferHelper

### safeTransfer

```solidity
function safeTransfer(address token, address to, uint256 value) internal
```

### safeTransferFrom

```solidity
function safeTransferFrom(address token, address from, address to, uint256 value) internal
```

### safeTransferBNB

```solidity
function safeTransferBNB(address to, uint256 value) internal
```

## IEIP721

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId) external
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokenId) external
```

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 tokenId)
```

## IERC721Receiver

### onERC721Received

```solidity
function onERC721Received(address operator, address from, uint256 tokenId, bytes data) external returns (bytes4)
```

## IWBNB

### deposit

```solidity
function deposit() external payable
```

### transfer

```solidity
function transfer(address to, uint256 value) external returns (bool)
```

### withdraw

```solidity
function withdraw(uint256) external
```

## IEIP20Permit

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```

## IEIP20

### decimals

```solidity
function decimals() external returns (uint8)
```

## NimbusP2P_V2Storage

### TradeSingle

```solidity
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
  uint256 status;
  bool isAskedAssetNFT;
}
```

### TradeMulti

```solidity
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
  uint256 status;
  bool isAskedAssetNFTs;
}
```

### TradeState

```solidity
enum TradeState {
  Active,
  Succeeded,
  Canceled,
  Withdrawn,
  Overdue
}
```

### WBNB

```solidity
contract IWBNB WBNB
```

### tradeCount

```solidity
uint256 tradeCount
```

### tradesSingle

```solidity
mapping(uint256 => struct NimbusP2P_V2Storage.TradeSingle) tradesSingle
```

### tradesMulti

```solidity
mapping(uint256 => struct NimbusP2P_V2Storage.TradeMulti) tradesMulti
```

### _userTrades

```solidity
mapping(address => uint256[]) _userTrades
```

### isAnyNFTAllowed

```solidity
bool isAnyNFTAllowed
```

### allowedNFT

```solidity
mapping(address => bool) allowedNFT
```

### isAnyEIP20Allowed

```solidity
bool isAnyEIP20Allowed
```

### allowedEIP20

```solidity
mapping(address => bool) allowedEIP20
```

### NewTradeSingle

```solidity
event NewTradeSingle(address user, address proposedAsset, uint256 proposedAmount, uint256 proposedTokenId, address askedAsset, uint256 askedAmount, uint256 askedTokenId, uint256 deadline, uint256 tradeId)
```

### NewTradeMulti

```solidity
event NewTradeMulti(address user, address[] proposedAssets, uint256 proposedAmount, uint256[] proposedIds, address[] askedAssets, uint256 askedAmount, uint256[] askedIds, uint256 deadline, uint256 tradeId)
```

### SupportTrade

```solidity
event SupportTrade(uint256 tradeId, address counterparty)
```

### CancelTrade

```solidity
event CancelTrade(uint256 tradeId)
```

### WithdrawOverdueAsset

```solidity
event WithdrawOverdueAsset(uint256 tradeId)
```

### UpdateIsAnyNFTAllowed

```solidity
event UpdateIsAnyNFTAllowed(bool isAllowed)
```

### UpdateAllowedNFT

```solidity
event UpdateAllowedNFT(address nftContract, bool isAllowed)
```

### UpdateIsAnyEIP20Allowed

```solidity
event UpdateIsAnyEIP20Allowed(bool isAllowed)
```

### UpdateAllowedEIP20Tokens

```solidity
event UpdateAllowedEIP20Tokens(address tokenContract, bool isAllowed)
```

### Rescue

```solidity
event Rescue(address to, uint256 amount)
```

### RescueToken

```solidity
event RescueToken(address to, address token, uint256 amount)
```

## NimbusP2P_V2

### initialize

```solidity
function initialize(address[] _allowedEIP20Tokens, bool[] _allowedEIP20TokenStates, address[] _allowedNFTTokens, bool[] _allowedNFTTokenStates, address _WBNB) public
```

Initialize P2P contract

_OpenZeppelin initializer ensures this can only be called once
This function also calls initializers on inherited contracts_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _allowedEIP20Tokens | address[] | array of allowed EIP20 tokens addresses |
| _allowedEIP20TokenStates | bool[] | allowed EIP20 token states |
| _allowedNFTTokens | address[] | array of allowed NFT tokens addresses |
| _allowedNFTTokenStates | bool[] | allowed NFT token states |
| _WBNB | address | WBNB address |

### receive

```solidity
receive() external payable
```

### setPaused

```solidity
function setPaused(bool isPaused) external
```

Sets Contract as paused

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPaused | bool | Pausable mode |

### createTradeEIP20ToEIP20

```solidity
function createTradeEIP20ToEIP20(address proposedAsset, uint256 proposedAmount, address askedAsset, uint256 askedAmount, uint256 deadline) external returns (uint256 tradeId)
```

Creates EIP20 to EIP20 trade

_This method makes it possible to create a trade for the exchange of tokens BEP20 standard. 
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAsset | address | asked asset contract address |
| askedAmount | uint256 | asked amount |
| deadline | uint256 | the expiration date of the trade |

### createTradeBNBtoEIP20

```solidity
function createTradeBNBtoEIP20(address askedAsset, uint256 askedAmount, uint256 deadline) external payable returns (uint256 tradeId)
```

Creates BNB to EIP20 trade

_This method makes it possible to create a BNB trade for EIP20 tokens. 
        ProposedAmount is passed in block msg.value
        for trade EIP20 > Native Coin use createTradeEIP20ToEIP20 and pass WBNB address as asked asset_

| Name | Type | Description |
| ---- | ---- | ----------- |
| askedAsset | address | proposed asset contract address |
| askedAmount | uint256 | proposed amount |
| deadline | uint256 | the expiration date of the trade |

### createTradeEIP20ToNFT

```solidity
function createTradeEIP20ToNFT(address proposedAsset, uint256 proposedAmount, address askedAsset, uint256 tokenId, uint256 deadline) external returns (uint256 tradeId)
```

Creates EIP20 to NFT trade

_This method makes it possible to create a trade for the exchange of tokens BEP20 standard for tokens EIP721 standart. 
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAsset | address | asked asset contract address |
| tokenId | uint256 | unique NFT token identifier |
| deadline | uint256 | the expiration date of the trade |

### createTradeNFTtoEIP20

```solidity
function createTradeNFTtoEIP20(address proposedAsset, uint256 tokenId, address askedAsset, uint256 askedAmount, uint256 deadline) external returns (uint256 tradeId)
```

Creates NFT to EIP20 trade

_This method makes it possible to create a trade for the exchange of tokens EIP721 standard for EIP20.
        for trade NFT > Native Coin use createTradeNFTtoEIP20 and pass WBNB address as asked asset_

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| tokenId | uint256 | unique NFT token identifier |
| askedAsset | address | asked asset contract address |
| askedAmount | uint256 | asked amount |
| deadline | uint256 | the expiration date of the trade |

### createTradeBNBtoNFT

```solidity
function createTradeBNBtoNFT(address askedAsset, uint256 tokenId, uint256 deadline) external payable returns (uint256 tradeId)
```

Creates BNB to NFT trade

_This method makes it possible to create a trade for the exchange BNB for EIP20 tokens. 
        ProposedAmount is passed in block msg.value_

| Name | Type | Description |
| ---- | ---- | ----------- |
| askedAsset | address | asked asset contract address |
| tokenId | uint256 | unique NFT token identifier |
| deadline | uint256 | the expiration date of the trade |

### createTradeEIP20ToNFTs

```solidity
function createTradeEIP20ToNFTs(address proposedAsset, uint256 proposedAmount, address[] askedAssets, uint256[] askedTokenIds, uint256 deadline) external returns (uint256 tradeId)
```

Creates EIP20 to NFTs multi trade

_This method makes it possible to create a trade for the exchange of tokens EIP20 standard for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAssets | address[] | an array of addresses asked asset contracts |
| askedTokenIds | uint256[] | array of ID NFT tokens |
| deadline | uint256 | the expiration date of the trade |

### createTradeNFTsToEIP20

```solidity
function createTradeNFTsToEIP20(address[] proposedAssets, uint256[] proposedTokenIds, address askedAsset, uint256 askedAmount, uint256 deadline) external returns (uint256 tradeId)
```

Creates NFTs to EIP20 multi trade

_This method makes it possible to create a trade for the exchange of any number of tokens EIP721 standard for EIP20 tokens. 
        Elements in the arrays proposedAssets and proposedAmounts must have the same indexes. 
        The first element of the proposedAssets array must match the first element of the proposedAmounts array and so on.
        for trade NFTs > Native Coin use createTradeNFTstoEIP20 and pass WBNB address as asked asset_

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAssets | address[] | an array of addresses proposed asset contracts |
| proposedTokenIds | uint256[] | asked tokens |
| askedAsset | address | asked asset contract address |
| askedAmount | uint256 | asked amount |
| deadline | uint256 | the expiration date of the trade |

### createTradeBNBtoNFTs

```solidity
function createTradeBNBtoNFTs(address[] askedAssets, uint256[] askedTokenIds, uint256 deadline) external payable returns (uint256 tradeId)
```

Creates BNB to NFTs multi trade

_This method makes it possible to create a trade for the exchange of BNB (Native chain coin) for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on._

| Name | Type | Description |
| ---- | ---- | ----------- |
| askedAssets | address[] | an array of addresses asked asset contracts |
| askedTokenIds | uint256[] | array of ID NFT tokens |
| deadline | uint256 | the expiration date of the trade |

### createTradeNFTsToNFTs

```solidity
function createTradeNFTsToNFTs(address[] proposedAssets, uint256[] proposedTokenIds, address[] askedAssets, uint256[] askedTokenIds, uint256 deadline) external returns (uint256 tradeId)
```

Creates NFTs to EIP20 multi trade

_This method makes it possible to create a trade for the exchange of any number of tokens EIP721 standard for any number of tokens EIP721 standard. 
        Elements in the arrays proposedAssets and proposedAmounts must have the same indexes. 
        The first element of the proposedAssets array must match the first element of the proposedAmounts array and so on.
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAssets | address[] | an array of addresses proposed asset contracts |
| proposedTokenIds | uint256[] | array of ID NFT tokens |
| askedAssets | address[] | an array of addresses asked asset contracts |
| askedTokenIds | uint256[] | array of ID NFT tokens |
| deadline | uint256 | the expiration date of the trade |

### createTradeEIP20ToEIP20Permit

```solidity
function createTradeEIP20ToEIP20Permit(address proposedAsset, uint256 proposedAmount, address askedAsset, uint256 askedAmount, uint256 deadline, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 tradeId)
```

Creates EIP20 to EIP20 trade with Permit

_This method makes it possible to create  trade for the exchange of tokens BEP20 standard. 
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAsset | address | asked asset contract address |
| askedAmount | uint256 | asked amount |
| deadline | uint256 | the expiration date of the trade |
| permitDeadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### createTradeEIP20ToNFTPermit

```solidity
function createTradeEIP20ToNFTPermit(address proposedAsset, uint256 proposedAmount, address askedAsset, uint256 tokenId, uint256 deadline, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 tradeId)
```

Creates EIP20 to NFT trade with Permit

_This method makes it possible to create a trade for the exchange of tokens BEP20 standard for tokens EIP721 standart. 
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAsset | address | asked asset contract address |
| tokenId | uint256 | unique NFT token identifier |
| deadline | uint256 | the expiration date of the trade |
| permitDeadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### createTradeEIP20ToNFTsPermit

```solidity
function createTradeEIP20ToNFTsPermit(address proposedAsset, uint256 proposedAmount, address[] askedAssets, uint256[] askedTokenIds, uint256 deadline, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 tradeId)
```

Creates EIP20 to NFTs multi trade with Permit

_This method makes it possible to create a trade for the exchange of tokens EIP20 standard for any number of NFT tokens. 
        Elements in the arrays asskedAssets and asskedAmounts must have the same indexes. 
        The first element of the asskedAssets array must match the first element of the asskedAmounts array and so on._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| askedAssets | address[] | an array of addresses asked asset contracts |
| askedTokenIds | uint256[] | array of ID NFT tokens |
| deadline | uint256 | the expiration date of the trade |
| permitDeadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### supportTradeSingle

```solidity
function supportTradeSingle(uint256 tradeId) external
```

Matches the trade by its id

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### supportTradeSingleBNB

```solidity
function supportTradeSingleBNB(uint256 tradeId) external payable
```

Matches the trade by its id

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the BNB on a wallet of the creator of trade is sent.
        This is a method of supporting single trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### supportTradeSingleWithPermit

```solidity
function supportTradeSingleWithPermit(uint256 tradeId, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external
```

Matches the single trade by its id (with Permit)

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |
| permitDeadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### supportTradeMulti

```solidity
function supportTradeMulti(uint256 tradeId) external
```

Matches the multi trade by its id

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### supportTradeMultiWithPermit

```solidity
function supportTradeMultiWithPermit(uint256 tradeId, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external
```

Matches the multi trade by its id (with Permit)

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |
| permitDeadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### cancelTrade

```solidity
function cancelTrade(uint256 tradeId) external
```

Cancels the trade by its id

_This method takes tradeId and cancels the thread before the deadline. As a result of his work, the proposed assets are returned to the wallet of the creator of the trade
        This is a method of canceling single trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### cancelTradeMulti

```solidity
function cancelTradeMulti(uint256 tradeId) external
```

Cancels the trade by its id

_This method takes tradeId and cancels the thread before the deadline. As a result of his work, the proposed assets are returned to the wallet of the creator of the trade
        This is a method of canceling multi trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### withdrawOverdueAssetSingle

```solidity
function withdrawOverdueAssetSingle(uint256 tradeId) external
```

Withdraws asset of the particular trade by its id when trade is overdue

_This method accepts tradeId and withdraws the proposed assets from the P2P contract after the trade deadline has expired. 
        As a result of his work, the proposed assets are returned to the wallet of the creator of the trade._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### withdrawOverdueAssetsMulti

```solidity
function withdrawOverdueAssetsMulti(uint256 tradeId) external
```

Withdraws asset of the particular trade by its id when trade is overdue

_This method accepts tradeId and withdraws the proposed assets from the P2P contract after the trade deadline has expired. 
        As a result of his work, the proposed assets are returned to the wallet of the creator of the trade._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### updateAllowedEIP20Tokens

```solidity
function updateAllowedEIP20Tokens(address[] tokens, bool[] states) external
```

allows particular EIP20 tokens for new trades

_This method allows the particular EIP20 tokens contracts to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokens | address[] | addresses of tokens |
| states | bool[] | booleans (is Allowed) |

### rescueEIP20

```solidity
function rescueEIP20(address to, address tokenAddress, uint256 amount) external
```

Rescues particular EIP20 token`s amount from contract to some address

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | address of recepient |
| tokenAddress | address | address of token |
| amount | uint256 | amount of token to be withdraw |

### rescueEIP721

```solidity
function rescueEIP721(address to, address tokenAddress, uint256 tokenId) external
```

Rescues particular NFT by Id from contract to some address

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | address of recepient |
| tokenAddress | address | address of NFT |
| tokenId | uint256 | id of token to be withdraw |

### toggleAnyNFTAllowed

```solidity
function toggleAnyNFTAllowed() external
```

allows all NFTs for new trades

_This method allows all the NFT contracts to be passed as proposed or asked assets for new trades_

### updateAllowedNFT

```solidity
function updateAllowedNFT(address nft, bool isAllowed) external
```

allows particular NFT for new trades

_This method allows the particular NFT contract to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| nft | address | address of NFT |
| isAllowed | bool | boolean (is Allowed) |

### toggleAnyEIP20Allowed

```solidity
function toggleAnyEIP20Allowed() external
```

allows all EIP20 tokens for new trades

_This method allows all the EIP20 tokens contracts to be passed as proposed or asked assets for new trades_

### getTradeMulti

```solidity
function getTradeMulti(uint256 id) external view returns (struct NimbusP2P_V2Storage.TradeMulti)
```

return the State of given multi trade by id

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | uint256 | unique trade identifier |

### state

```solidity
function state(uint256 tradeId) external view returns (enum NimbusP2P_V2Storage.TradeState)
```

return whether State of Single trade is active

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### stateMulti

```solidity
function stateMulti(uint256 tradeId) external view returns (enum NimbusP2P_V2Storage.TradeState)
```

return whether State of Multi trade is active

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### userTrades

```solidity
function userTrades(address user) external view returns (uint256[])
```

return returns the array of user`s trades Ids

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | user address |

### onERC721Received

```solidity
function onERC721Received(address operator, address from, uint256 tokenId, bytes data) external pure returns (bytes4)
```

_Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721safeTransferFrom}
by `operator` from `from`, this function is called.

It must return its Solidity selector to confirm the token transfer.
If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.

The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`._

### _requireAllowedNFT

```solidity
function _requireAllowedNFT(address nftContract) private view
```

requires NFT to be allowed

| Name | Type | Description |
| ---- | ---- | ----------- |
| nftContract | address | nftContract address to check for allowance |

### _requireAllowedEIP20

```solidity
function _requireAllowedEIP20(address tokenContract) private view
```

requires EIP20 token to be allowed

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenContract | address | tokenContract to check for allowance |

### _createTradeSingle

```solidity
function _createTradeSingle(address proposedAsset, uint256 proposedAmount, uint256 proposedTokenId, address askedAsset, uint256 askedAmount, uint256 askedTokenId, uint256 deadline, bool isNFTAskedAsset) private returns (uint256 tradeId)
```

Creates new trade

_This method makes it possible to create a trade.
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAsset | address | proposed asset contract address |
| proposedAmount | uint256 | proposed amount |
| proposedTokenId | uint256 | proposed asset token Id |
| askedAsset | address | asked asset contract address |
| askedAmount | uint256 | asked amount |
| askedTokenId | uint256 | asked asset token Id |
| deadline | uint256 | the expiration date of the trade |
| isNFTAskedAsset | bool | whether asked asset is NFT |

### _createTradeMulti

```solidity
function _createTradeMulti(address[] proposedAssets, uint256 proposedAmount, uint256[] proposedTokenIds, address[] askedAssets, uint256 askedAmount, uint256[] askedTokenIds, uint256 deadline, bool isNFTsAskedAsset) private returns (uint256 tradeId)
```

Creates new trade

_This method makes it possible to create a trade.
        You can only exchange tokens allowed on the platform._

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposedAssets | address[] | proposed assets contract addresses |
| proposedAmount | uint256 | proposed amount |
| proposedTokenIds | uint256[] | proposed assets token Ids |
| askedAssets | address[] | asked assets contract addresses |
| askedAmount | uint256 | asked amount |
| askedTokenIds | uint256[] | asked assets token Ids |
| deadline | uint256 | the expiration date of the trade |
| isNFTsAskedAsset | bool | whether asked asset is NFT |

### _supportTradeSingle

```solidity
function _supportTradeSingle(uint256 tradeId) private
```

Matches the trade by its id

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting single trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### _supportTradeMulti

```solidity
function _supportTradeMulti(uint256 tradeId) private
```

Matches the multi trade by its id

_This method accepts tradeId and supports this trade. 
        As a result of work of this method from a wallet the assked asset on a wallet of the creator of trade is sent.
        This is a method of supporting multi trades._

| Name | Type | Description |
| ---- | ---- | ----------- |
| tradeId | uint256 | unique trade identifier |

### _updateAllowedNFT

```solidity
function _updateAllowedNFT(address nft, bool isAllowed) private
```

allows particular NFT for new trades

_This method allows the particular NFT contract to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| nft | address | address of NFT |
| isAllowed | bool | boolean (is Allowed) |

### _updateAllowedNFTs

```solidity
function _updateAllowedNFTs(address[] nfts, bool[] states) private
```

allows particular NFTs for new trades

_This method allows the particular NFTs contracts to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| nfts | address[] | addresses of NFTs |
| states | bool[] | booleans (is Allowed) |

### _updateAllowedEIP20Token

```solidity
function _updateAllowedEIP20Token(address token, bool isAllowed) private
```

allows particular EIP20 token contract for new trades

_This method allows the particular EIP20 contract to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | address of token |
| isAllowed | bool | boolean (is Allowed) |

### _updateAllowedEIP20Tokens

```solidity
function _updateAllowedEIP20Tokens(address[] tokens, bool[] states) private
```

allows particular EIP20 tokens for new trades

_This method allows the particular EIP20 tokens contracts to be passed as proposed or asked assets for new trades_

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokens | address[] | addresses of tokens |
| states | bool[] | booleans (is Allowed) |

