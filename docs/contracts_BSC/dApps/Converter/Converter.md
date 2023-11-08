# Solidity API

## IPriceFeed

### queryRate

```solidity
function queryRate(address sourceTokenAddress, address destTokenAddress) external view returns (uint256 rate, uint256 precision)
```

## IEIP20Permit

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```

## Converter

### manualRate

```solidity
uint256 manualRate
```

### minConvertAmount

```solidity
uint256 minConvertAmount
```

### usePriceFeeds

```solidity
bool usePriceFeeds
```

### priceFeed

```solidity
contract IPriceFeed priceFeed
```

### purchaseToken

```solidity
contract IERC20 purchaseToken
```

### receiveToken

```solidity
contract IERC20 receiveToken
```

### Rescue

```solidity
event Rescue(address to, uint256 amount)
```

### RescueToken

```solidity
event RescueToken(address to, address token, uint256 amount)
```

### ToggleUsePriceFeeds

```solidity
event ToggleUsePriceFeeds(bool usePriceFeeds)
```

### Convert

```solidity
event Convert(address to, uint256 purchaseAmount, uint256 receiveAmount, uint256 time)
```

### constructor

```solidity
constructor(address _purchaseToken, address _receiveToken) public
```

Converter contract

| Name | Type | Description |
| ---- | ---- | ----------- |
| _purchaseToken | address | purchase token which will be converted |
| _receiveToken | address | token which will be received after convert |

### convert

```solidity
function convert(uint256 amount) external
```

Convertion from purchaseToken to receiveToken

_This method converts purchaseToken to ReceiveToken using rates from PriceFeed. 
Amount should be greater than minimal amount to Convert. "Purchase" tokens are being transfered to Contract.
"Receive" tokens are being transfered to caller._

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount of purchaseToken to convert |

### convertWithPermit

```solidity
function convertWithPermit(uint256 amount, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external
```

Convertion from purchaseToken to receiveToken

_This method converts purchaseToken to ReceiveToken using rates from PriceFeed. 
Amount should be greater than minimal amount to Convert. "Purchase" tokens are being transfered to Contract.
"Receive" tokens are being transfered to caller._

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount of purchaseToken to convert |
| permitDeadline | uint256 | deadline of Permit operation |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### getEquivalentAmount

```solidity
function getEquivalentAmount(uint256 amount) public view returns (uint256)
```

View method for getting equivalent amount of ReceiveTokens in PurchaseTokens

_This method gets amount of ReceiveTokens equivalent to PurchaseToken amount using PriceFeed._

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount of purchaseToken |

### receiveTokenSupply

```solidity
function receiveTokenSupply() public view returns (uint256)
```

View method for getting reserve of receiveToken

_This method is getter for amount of ReceiveTokens that are stored on current Contract._

### purchaseTokenSupply

```solidity
function purchaseTokenSupply() public view returns (uint256)
```

View method for getting reserve of purchaseToken

_This method is getter for amount of PurchaseTokens that are stored on current Contract._

### setManualRate

```solidity
function setManualRate(uint256 newRate) external
```

Sets rate of PurchaseToken/ReceiveToken manually

_This method sets Rate for convertion PurchaseTokens to RecieveTokens.
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRate | uint256 | new rate of PurchaseToken/ReceiveToken |

### setMinConvertAmount

```solidity
function setMinConvertAmount(uint256 newMinConvertAmount) external
```

Sets minimum amount for convertion

_This method sets new minimum amount for convertion PurchaseTokens to RecieveTokens.
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newMinConvertAmount | uint256 | new minimum amount for convertion |

### updatePriceFeed

```solidity
function updatePriceFeed(address newPriceFeed) external
```

Updates PriceFeed

_This method sets new PriceFeed for rate of PurchaseToken/ReceiveToken
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPriceFeed | address | new PriceFeed`s address |

### updateUsePriceFeeds

```solidity
function updateUsePriceFeeds(bool isEnabled) external
```

Enables/Disables convertion using PriceFeed

_This method enables/disables PriceFeed usage in tokens convertion
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| isEnabled | bool | boolean of "PriceFeed-mode" |

### setPaused

```solidity
function setPaused(bool isPaused) external
```

Sets Contract as paused

| Name | Type | Description |
| ---- | ---- | ----------- |
| isPaused | bool | Pausable mode |

### rescue

```solidity
function rescue(address to, contract IERC20 token, uint256 amount) external
```

Rescues ERC20 tokens from Contract

_This method rescues particular amount of ERC20 token from contract to given address.
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | address to withdraw tokens |
| token | contract IERC20 | address of ERC20 token |
| amount | uint256 | amount of ERC20 token |

### rescue

```solidity
function rescue(address payable to, uint256 amount) external
```

Rescues BNB from Contract

_This method rescues particular amount of BNB from contract to given address.
Can be executed only by owner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address payable | address to withdraw BNB |
| amount | uint256 | amount of BNB |

