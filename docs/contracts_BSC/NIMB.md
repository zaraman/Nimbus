# Solidity API

## IBEP20

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### decimals

```solidity
function decimals() external view returns (uint8)
```

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

### getOwner

```solidity
function getOwner() external view returns (address)
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

## Ownable

### owner

```solidity
address owner
```

### newOwner

```solidity
address newOwner
```

### OwnershipTransferred

```solidity
event OwnershipTransferred(address from, address to)
```

### constructor

```solidity
constructor() public
```

### onlyOwner

```solidity
modifier onlyOwner()
```

### transferOwnership

```solidity
function transferOwnership(address transferOwner) external
```

### acceptOwnership

```solidity
function acceptOwnership() public virtual
```

## Pausable

### Pause

```solidity
event Pause()
```

### Unpause

```solidity
event Unpause()
```

### paused

```solidity
bool paused
```

### whenNotPaused

```solidity
modifier whenNotPaused()
```

### whenPaused

```solidity
modifier whenPaused()
```

### pause

```solidity
function pause() public
```

### unpause

```solidity
function unpause() public
```

## NIMB

### _allowances

```solidity
mapping(address => mapping(address => uint256)) _allowances
```

### _unfrozenBalances

```solidity
mapping(address => uint256) _unfrozenBalances
```

### _vestingNonces

```solidity
mapping(address => uint256) _vestingNonces
```

### _vestingAmounts

```solidity
mapping(address => mapping(uint256 => uint256)) _vestingAmounts
```

### _unvestedAmounts

```solidity
mapping(address => mapping(uint256 => uint256)) _unvestedAmounts
```

### _vestingTypes

```solidity
mapping(address => mapping(uint256 => uint256)) _vestingTypes
```

### _vestingReleaseStartDates

```solidity
mapping(address => mapping(uint256 => uint256)) _vestingReleaseStartDates
```

### _totalSupply

```solidity
uint256 _totalSupply
```

### _name

```solidity
string _name
```

### _symbol

```solidity
string _symbol
```

### _decimals

```solidity
uint8 _decimals
```

### vestingFirstPeriod

```solidity
uint256 vestingFirstPeriod
```

### vestingSecondPeriod

```solidity
uint256 vestingSecondPeriod
```

### giveAmount

```solidity
uint256 giveAmount
```

### vesters

```solidity
mapping(address => bool) vesters
```

### allowedReceivers

```solidity
mapping(address => bool) allowedReceivers
```

### receiversListLocked

```solidity
bool receiversListLocked
```

### issuedSupply

```solidity
uint256 issuedSupply
```

### DOMAIN_SEPARATOR

```solidity
bytes32 DOMAIN_SEPARATOR
```

### PERMIT_TYPEHASH

```solidity
bytes32 PERMIT_TYPEHASH
```

### nonces

```solidity
mapping(address => uint256) nonces
```

### Unvest

```solidity
event Unvest(address user, uint256 amount)
```

### UpdateAllowedReceiver

```solidity
event UpdateAllowedReceiver(address receiver, bool isAllowed)
```

### constructor

```solidity
constructor() public
```

### receive

```solidity
receive() external payable
```

### getOwner

```solidity
function getOwner() public view returns (address)
```

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets amount as the allowance of spender over the caller's tokens.
Returns a boolean value indicating whether the operation succeeded._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | address of token spender |
| amount | uint256 | the number of tokens that are allowed to spend
 Emits an {Approval} event |

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves amount tokens from the caller's account to recipient.
Returns a boolean value indicating whether the operation succeeded.
Emits a {Transfer} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | address of user |
| amount | uint256 | amount of token that you want to send |

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves amount tokens from src to dst using the
allowance mechanism
amount is then deducted from the caller's allowance.
Returns a boolean value indicating whether the operation succeeded.
Emits a {Transfer} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | address from |
| recipient | address | address of user |
| amount | uint256 | amount of token that you want to send |

### mint

```solidity
function mint(address receiver, uint256 amount) public
```

_Mint tokens to receiver address_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | address receiver |
| amount | uint256 | mint amount |

### permit

```solidity
function permit(address owner, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```

This method can be used to change an account's ERC20 allowance by
presenting a message signed by the account. By not relying on {IERC20-approve}, the token holder account doesn't
need to send a transaction, and thus is not required to hold Ether at all.

_Sets value as the allowance of spender over owner's tokens,
given owner's signed approval_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address of token owner |
| spender | address | address of token spender |
| amount | uint256 | the number of tokens that are allowed to spend |
| deadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external returns (bool)
```

_Atomically increases the allowance granted to spender by the caller._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | address of user |
| addedValue | uint256 | value of tokens 
 Emits an {Approval} event indicating the updated allowance. |

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool)
```

_Atomically decreases the allowance granted to spender by the caller._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | address of user |
| subtractedValue | uint256 | value of tokens 
 Emits an {Approval} event indicating the updated allowance. |

### unvest

```solidity
function unvest() external returns (uint256 unvested)
```

_This method is used to withdraw tokens from vesting
Emits a {Unvest} event._

### give

```solidity
function give(address user, uint256 amount, uint256 vesterId) external
```

_Sends tokens to vesting_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| amount | uint256 | NIMB amount |
| vesterId | uint256 | vester Id |

### vest

```solidity
function vest(address user, uint256 amount) external
```

_Transfer frozen funds to user_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| amount | uint256 | NIMB amount 
 Emits a {Transfer} event. |

### burnTokens

```solidity
function burnTokens(uint256 amount) external returns (bool success)
```

_Destroys the number of tokens from the owner account, reducing the total supply.
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | the number of tokens that will be burned
 Emits a {Transfer} event. |

### updateAllowedReceiver

```solidity
function updateAllowedReceiver(address receiver, bool isAllowed) external
```

_update allowed receivers_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | address of user |
| isAllowed | bool | boolean condition
 Emits a {Transfer} event. |

### lockReceiversList

```solidity
function lockReceiversList() external
```

_Block addind new receivers_

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that spender will be
allowed to spend on behalf of owner through {transferFrom}. 
This is zero by default.
This value changes when {approve} or {transferFrom} are called_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | address of token owner |
| spender | address | address of token spender |

### decimals

```solidity
function decimals() external pure returns (uint8)
```

### name

```solidity
function name() external pure returns (string)
```

### symbol

```solidity
function symbol() external pure returns (string)
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_View method that returns the number of tokens owned by account
and vesting balance_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |

### availableForUnvesting

```solidity
function availableForUnvesting(address user) external view returns (uint256 unvestAmount)
```

View method to get available for unvesting volume

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |

### availableForTransfer

```solidity
function availableForTransfer(address account) external view returns (uint256)
```

View method to get available for transfer amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |

### vestingInfo

```solidity
function vestingInfo(address user, uint256 nonce) external view returns (uint256 vestingAmount, uint256 unvestedAmount, uint256 vestingReleaseStartDate, uint256 vestType)
```

View method to get vesting Information

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| nonce | uint256 | nonce of current lock |

### vestingNonces

```solidity
function vestingNonces(address user) external view returns (uint256 lastNonce)
```

View method to get last vesting nonce for user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |

### _approve

```solidity
function _approve(address owner, address spender, uint256 amount) private
```

### _transfer

```solidity
function _transfer(address sender, address recipient, uint256 amount) private
```

### _vest

```solidity
function _vest(address user, uint256 amount, uint256 vestType) private
```

### multisend

```solidity
function multisend(address[] to, uint256[] values) external returns (uint256)
```

_This method is used to send funds to several users in single transaction (up to 99 users)
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address[] | an array of  the user's adresses |
| values | uint256[] | an array of NIMB amounts
 Emits a {Transfer} event. |

### multivest

```solidity
function multivest(address[] to, uint256[] values) external returns (uint256)
```

_This method is used to accrue frozen funds to several users at the same time (up to 99 users)
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address[] | an array of  the user's adresses |
| values | uint256[] | an array of NIMB amounts
 Emits a {Transfer} event. |

### updateVesters

```solidity
function updateVesters(address vester, bool isActive) external
```

_This method is used to add new vesters
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| vester | address | new vester |
| isActive | bool | boolean condition |

### updateGiveAmount

```solidity
function updateGiveAmount(uint256 amount) external
```

_This method is update give amount
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | new amount |

### transferAnyBEP20Token

```solidity
function transferAnyBEP20Token(address tokenAddress, uint256 tokens) external returns (bool success)
```

_This method is used to withdraw any ERC20 tokens from the contract
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenAddress | address | token address |
| tokens | uint256 | token amount |

### acceptOwnership

```solidity
function acceptOwnership() public
```

