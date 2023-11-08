# Solidity API

## INimbusRouter

### swapExactTokensForBNB

```solidity
function swapExactTokensForBNB(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external returns (uint256[] amounts)
```

### NBU_WBNB

```solidity
function NBU_WBNB() external view returns (address)
```

### getAmountsOut

```solidity
function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)
```

## IPancakeRouter

### swapExactETHForTokens

```solidity
function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) external payable returns (uint256[] amounts)
```

### WETH

```solidity
function WETH() external view returns (address)
```

### getAmountsOut

```solidity
function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)
```

## ILockStakingRewards

### earned

```solidity
function earned(address account) external view returns (uint256)
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

### stake

```solidity
function stake(uint256 amount) external
```

### stakeLocks

```solidity
function stakeLocks(address user, uint256 stakeNonce) external returns (uint256)
```

### stakeAmounts

```solidity
function stakeAmounts(address user, uint256 stakeNonce) external returns (uint256)
```

### stakeFor

```solidity
function stakeFor(uint256 amount, address user) external
```

### getReward

```solidity
function getReward() external
```

### withdraw

```solidity
function withdraw(uint256 nonce) external
```

### withdrawAndGetReward

```solidity
function withdrawAndGetReward(uint256 nonce) external
```

### lockDuration

```solidity
function lockDuration() external returns (uint256)
```

## TakeIT

### PurchaseRecord

```solidity
struct PurchaseRecord {
  address token;
  uint256 amount;
  uint256 purchased;
  uint256 distributed;
  uint256 rate;
  uint256 amountBusd;
}
```

### StakingInfo

```solidity
struct StakingInfo {
  address user;
  uint256 nonce;
  uint256 stakingTime;
  uint256 amount;
  uint256 rate;
  uint256 bnbBusdRate;
}
```

### _tokenIdCounter

```solidity
struct CountersUpgradeable.Counter _tokenIdCounter
```

### purchaseToken

```solidity
contract IERC20Upgradeable purchaseToken
```

### lastTokenId

```solidity
uint256 lastTokenId
```

### soldTokens

```solidity
uint256 soldTokens
```

### baseUri

```solidity
string baseUri
```

### purchaseRecords

```solidity
mapping(uint256 => struct TakeIT.PurchaseRecord) purchaseRecords
```

### allowedUpdaters

```solidity
mapping(address => bool) allowedUpdaters
```

### PurchasedNFT

```solidity
event PurchasedNFT(address newOwner, uint256 tokenId, address purchaseToken, uint256 purchaseAmount, uint256 stakingNonce, uint256 stakingTime)
```

### Distribute

```solidity
event Distribute(address token, address to, uint256 amount, uint256 tokenId)
```

### SetAmountRate

```solidity
event SetAmountRate(uint256 tokenId, uint256 amount, uint256 rate, uint256 bnbBusdRate)
```

### UpdateBonusRate

```solidity
event UpdateBonusRate(uint256 newBonusRate)
```

### UpdateRouters

```solidity
event UpdateRouters(address newNimbusRouter, address newPancakeRouter)
```

### SupplyBusd

```solidity
event SupplyBusd(address tokenOwner, uint256 tokenId, uint256 amountBusd)
```

### SetStakingContract

```solidity
event SetStakingContract(address stakingContract)
```

### TokensUpdated

```solidity
event TokensUpdated(address purchaseToken, address busd)
```

### ConfirmOrder

```solidity
event ConfirmOrder(uint256 tokenId, uint256 nbuToSwap, uint256 resultedBusd, bool isMannual)
```

### description

```solidity
string description
```

### stakingContract

```solidity
contract ILockStakingRewards stakingContract
```

### stakingInfos

```solidity
mapping(uint256 => struct TakeIT.StakingInfo) stakingInfos
```

### usedStakes

```solidity
mapping(address => mapping(uint256 => bool)) usedStakes
```

### BusdContract

```solidity
contract IERC20Upgradeable BusdContract
```

### nimbusRouter

```solidity
contract INimbusRouter nimbusRouter
```

### pancakeRouter

```solidity
contract IPancakeRouter pancakeRouter
```

### bonusRate

```solidity
uint256 bonusRate
```

### onlyAllowedUpdaters

```solidity
modifier onlyAllowedUpdaters()
```

_Checks if msg.sender is allowed to update state_

### receive

```solidity
receive() external payable
```

_This method recieves bnb native coin if msg.sender is Nimbus router or WBNB address_

### initialize

```solidity
function initialize(address _purchaseToken, address _stakingContract, address _busdContract) public
```

Initialize state of contract

_This method sets staking token, payment token and staking contract address_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _purchaseToken | address | - token that was staked (initially it is NBU) |
| _stakingContract | address | - staking contract |
| _busdContract | address | - payment token (BUSD) |

### changeStakingContract

```solidity
function changeStakingContract(address _stakingContract) external
```

Updates staking contract

_This method sets new staking contract address if changed_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _stakingContract | address | - staking contract |

### purchase

```solidity
function purchase(address to, uint256 amount, uint256 stakingNonce) public
```

Purchase of NFT for particular withdrawn staking

_This method creates an NFT and sends it to user. 
NFT is created for particular withdrawn staking with is determined by staking nonce._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | - address of user to owe NFT |
| amount | uint256 | - amount of NBU tokens |
| stakingNonce | uint256 | - staking nonce for particular NFT |

### distribute

```solidity
function distribute(address to, uint256 tokenId) external
```

Distribution of unreleased NBU

_This method rescues unreleases NBU by particular tokenId to some reciepient.
Only owner cam execute this method_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | - address of user to distribute unreleased NBU |
| tokenId | uint256 | - NFT id |

### setAmountRate

```solidity
function setAmountRate(uint256 tokenId, uint256 amount, uint256 rate, uint256 bnbBusdRate) external
```

Setting up of staking parameters by particular nonce

_This method sets staking amount and historical rates of staking by particular staking nonce.
Only allowed updaters can execute this method/_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |
| amount | uint256 | - amount of token that was staked by nonce registered for particular tokenId |
| rate | uint256 | - historical rate NBU/BNB |
| bnbBusdRate | uint256 | - historical rate NBU/BUSD |

### getAmountsAndRates

```solidity
function getAmountsAndRates(uint256 tokenId) public view returns (uint256 BnbNburate, uint256 BnbBusdRate, uint256 NBUAmount, uint256 BusdNbuRate)
```

View method to get nbu staking amount and all needed historical rates.

_This method is to get nbu staking amount and historical rates for particular tokenId
Returns NBU/BNB rate, BUSD/BNB rate, NBU stakin amount, NBU/BUSD_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |

### getTokenReserves

```solidity
function getTokenReserves(uint256 tokenId) public view returns (uint256 amountNbu, uint256 amountBusd)
```

View method to get tokens reserves

_This method is to get staking token reserve (how much is left) 
and payment token reserve (how much was received)
Returns reserve of NBU for particlular tokenId 
and amount of BUSD that was received for swapping NBU_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |

### Rates

```solidity
struct Rates {
  uint256 NbuBnbRate;
  uint256 NbuAmount;
  uint256 BusdBnbRate;
  uint256 NbuBusdRate;
  uint256 reserveNbu;
  uint256 amountBusd;
}
```

### getListAmountsRates

```solidity
function getListAmountsRates(uint256 from, uint256 to) public view returns (struct TakeIT.Rates[])
```

### burnNFT

```solidity
function burnNFT(uint256 tokenId) external
```

Burning of NFT

_This method burns NFT by particular tokenId. Can be called only by NFT owner.
Can be burned only if there is no more NBU to swap._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |

### getBusdBNBamount

```solidity
function getBusdBNBamount(uint256 tokenId, uint256 amountNbu) public view returns (uint256 amountBusd, uint256 amountBNB, uint256 BusdNbuRate, uint256 BnbNburate, uint256 NBUAmount, uint256 BnbBusdRate)
```

### supplyBusd

```solidity
function supplyBusd(uint256 tokenId, uint256 busdToSend) external
```

Supplies BUSD for particular tokenId

_This method sends BUSD and updates NBU reserves
Can be executed only by allowed updaters_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |
| busdToSend | uint256 | - BUSD that is sended |

### confirmOrder

```solidity
function confirmOrder(uint256 tokenId, uint256 amountToSwap) external
```

Auto swap of NBU via swap machines

_This method confirms order swapping NBU->BUSD using path NBU->BNB->BUSD
Can be executed only by allowed updaters_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | - NFT id |
| amountToSwap | uint256 | - amount of NBU to swap |

### updateAllowedUpdater

```solidity
function updateAllowedUpdater(address updater, bool isActive) external
```

Updates allowed updater

_This method sets some address as true/false for allowing updates in contract
Can be executed only by owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| updater | address | - address of updater |
| isActive | bool | - boolean of if updater is allowed |

### updateBonusRate

```solidity
function updateBonusRate(uint256 newRate) external
```

Updatesbonus rate

_This method sets new bonus rate which is important when user burns NFT
Can be executed only by owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRate | uint256 | - new bonus rate |

### updateRouters

```solidity
function updateRouters(address newNimbusRouter, address newPancakeRouter) external
```

Updates routers

_This method sets 2 routers for contract parameters
Can be executed only by owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newNimbusRouter | address | - address of Nimbus Router |
| newPancakeRouter | address | - address of Pancake Router |

### updateTokens

```solidity
function updateTokens(address newPurchaseToken, address newBUSD) external
```

Updates system tokens

_This method sets 2 system tokens for contract parameters
Can be executed only by owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPurchaseToken | address | - address of Purchase token |
| newBUSD | address | - address of BUSD token |

### setBaseUri

```solidity
function setBaseUri(string uri) external
```

### _baseURI

```solidity
function _baseURI() internal view returns (string)
```

_Base URI for computing {tokenURI}. If set, the resulting URI for each
token will be the concatenation of the `baseURI` and the `tokenId`. Empty
by default, can be overridden in child contracts._

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal
```

### _burn

```solidity
function _burn(uint256 tokenId) internal
```

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view returns (string)
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view returns (bool)
```

