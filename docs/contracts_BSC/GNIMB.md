# Solidity API

## IERC20

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### balanceOf

```solidity
function balanceOf(address tokenOwner) external view returns (uint256 balance)
```

### allowance

```solidity
function allowance(address tokenOwner, address spender) external view returns (uint256 remaining)
```

### transfer

```solidity
function transfer(address to, uint256 tokens) external returns (bool success)
```

### approve

```solidity
function approve(address spender, uint256 tokens) external returns (bool success)
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokens) external returns (bool success)
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 tokens)
```

### Approval

```solidity
event Approval(address tokenOwner, address spender, uint256 tokens)
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
function acceptOwnership() external virtual
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

## GNIMB

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### totalSupply

```solidity
uint96 totalSupply
```

### allowances

```solidity
mapping(address => mapping(address => uint96)) allowances
```

### _unfrozenBalances

```solidity
mapping(address => uint96) _unfrozenBalances
```

### _vestingNonces

```solidity
mapping(address => uint32) _vestingNonces
```

### _vestingAmounts

```solidity
mapping(address => mapping(uint32 => uint96)) _vestingAmounts
```

### _unvestedAmounts

```solidity
mapping(address => mapping(uint32 => uint96)) _unvestedAmounts
```

### _vestingReleaseStartDates

```solidity
mapping(address => mapping(uint32 => uint256)) _vestingReleaseStartDates
```

### vesters

```solidity
mapping(address => bool) vesters
```

### vestingFirstPeriod

```solidity
uint96 vestingFirstPeriod
```

### vestingSecondPeriod

```solidity
uint96 vestingSecondPeriod
```

### supportUnits

```solidity
address[] supportUnits
```

### supportUnitsCnt

```solidity
uint256 supportUnitsCnt
```

### delegates

```solidity
mapping(address => address) delegates
```

### Checkpoint

```solidity
struct Checkpoint {
  uint32 fromBlock;
  uint96 votes;
}
```

### checkpoints

```solidity
mapping(address => mapping(uint32 => struct GNIMB.Checkpoint)) checkpoints
```

### numCheckpoints

```solidity
mapping(address => uint32) numCheckpoints
```

### DOMAIN_TYPEHASH

```solidity
bytes32 DOMAIN_TYPEHASH
```

### DELEGATION_TYPEHASH

```solidity
bytes32 DELEGATION_TYPEHASH
```

### PERMIT_TYPEHASH

```solidity
bytes32 PERMIT_TYPEHASH
```

### nonces

```solidity
mapping(address => uint256) nonces
```

### DelegateChanged

```solidity
event DelegateChanged(address delegator, address fromDelegate, address toDelegate)
```

### DelegateVotesChanged

```solidity
event DelegateVotesChanged(address delegate, uint256 previousBalance, uint256 newBalance)
```

### Transfer

```solidity
event Transfer(address from, address to, uint256 amount)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 amount)
```

### Unvest

```solidity
event Unvest(address user, uint256 amount)
```

### constructor

```solidity
constructor() public
```

### receive

```solidity
receive() external payable
```

### freeCirculation

```solidity
function freeCirculation() external view returns (uint256)
```

View method to get amount of funds in circulation

_freeCirculation is calculated as the total amount minus the balance on the owner's wallet and the Support Unit_

### allowance

```solidity
function allowance(address account, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that spender will be
allowed to spend on behalf of owner through {transferFrom}. 
This is zero by default.
This value changes when {approve} or {transferFrom} are called_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of token owner |
| spender | address | address of token spender |

### approve

```solidity
function approve(address spender, uint256 rawAmount) external returns (bool)
```

_Sets amount as the allowance of spender over the caller's tokens.
Returns a boolean value indicating whether the operation succeeded._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | address of token spender |
| rawAmount | uint256 | the number of tokens that are allowed to spend
 Emits an {Approval} event |

### permit

```solidity
function permit(address owner, address spender, uint256 rawAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
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
| rawAmount | uint256 | the number of tokens that are allowed to spend |
| deadline | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### balanceOf

```solidity
function balanceOf(address account) public view returns (uint256)
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
function vestingInfo(address user, uint32 nonce) external view returns (uint256 vestingAmount, uint256 unvestedAmount, uint256 vestingReleaseStartDate)
```

View method to get vesting Information

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| nonce | uint32 | nonce of current lock |

### vestingNonces

```solidity
function vestingNonces(address user) external view returns (uint256 lastNonce)
```

View method to get last vesting nonce for user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |

### transfer

```solidity
function transfer(address dst, uint256 rawAmount) external returns (bool)
```

_Moves amount tokens from the caller's account to dst.
Returns a boolean value indicating whether the operation succeeded.
Emits a {Transfer} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dst | address | address of user |
| rawAmount | uint256 | amount of token that you want to send |

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 rawAmount) external returns (bool)
```

_Moves amount tokens from src to dst using the
allowance mechanism
amount is then deducted from the caller's allowance.
Returns a boolean value indicating whether the operation succeeded.
Emits a {Transfer} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| src | address | address from |
| dst | address | address of user |
| rawAmount | uint256 | amount of token that you want to send |

### delegate

```solidity
function delegate(address delegatee) public
```

Changes delegatee

_delegate your votes to another user_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| delegatee | address | address of user |

### delegateBySig

```solidity
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) public
```

Changes delegatee

_delegate your votes to another user with signature_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| delegatee | address | address of user |
| nonce | uint256 | signature nonce |
| expiry | uint256 | the expiration date of the permit |
| v | uint8 | the recovery id |
| r | bytes32 | outputs of an ECDSA signature |
| s | bytes32 | outputs of an ECDSA signature |

### unvest

```solidity
function unvest() external returns (uint256 unvested)
```

_This method is used to withdraw tokens from vesting
Emits a {Unvest} event._

### getCurrentVotes

```solidity
function getCurrentVotes(address account) external view returns (uint96)
```

View method to get total number of delegated votes for user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |

### getPriorVotes

```solidity
function getPriorVotes(address account, uint256 blockNumber) public view returns (uint96)
```

View method to get total number of delegated votes for the user at a particular moment (block number)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |
| blockNumber | uint256 | particular block number |

### _delegate

```solidity
function _delegate(address delegator, address delegatee) internal
```

### _transferTokens

```solidity
function _transferTokens(address src, address dst, uint96 amount) internal
```

### _moveDelegates

```solidity
function _moveDelegates(address srcRep, address dstRep, uint96 amount) internal
```

### _writeCheckpoint

```solidity
function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint96 oldVotes, uint96 newVotes) internal
```

### _vest

```solidity
function _vest(address user, uint96 amount) private
```

### burnTokens

```solidity
function burnTokens(uint256 rawAmount) public returns (bool success)
```

_Destroys the number of tokens from the owner account, reducing the total supply.
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rawAmount | uint256 | the number of tokens that will be burned
 Emits a {Transfer} event. |

### vest

```solidity
function vest(address user, uint256 rawAmount) external
```

_Transfer frozen funds to user_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| rawAmount | uint256 | GNIMB amount 
 Emits a {Transfer} event. |

### multisend

```solidity
function multisend(address[] to, uint256[] values) public returns (uint256)
```

_This method is used to send funds to several users in single transaction (up to 99 users)
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address[] | an array of  the user's adresses |
| values | uint256[] | an array of GNIMB amounts
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
| values | uint256[] | an array of GNIMB amounts
 Emits a {Transfer} event. |

### transferAnyERC20Token

```solidity
function transferAnyERC20Token(address tokenAddress, uint256 tokens) public returns (bool success)
```

_This method is used to withdraw any ERC20 tokens from the contract
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenAddress | address | token address |
| tokens | uint256 | token amount |

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

### acceptOwnership

```solidity
function acceptOwnership() public
```

### updateSupportUnitAdd

```solidity
function updateSupportUnitAdd(address newSupportUnit) external
```

_This method is used to add addresses that were excluded from circulation 
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSupportUnit | address | new SupportUnit address |

### updateSupportUnitRemove

```solidity
function updateSupportUnitRemove(uint256 supportUnitIndex) external
```

_This method is used to  remove address from SuportUnit
can be called only from the owner account_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| supportUnitIndex | uint256 | index of SuportUnit |

### safe32

```solidity
function safe32(uint256 n, string errorMessage) internal pure returns (uint32)
```

### safe96

```solidity
function safe96(uint256 n, string errorMessage) internal pure returns (uint96)
```

### add96

```solidity
function add96(uint96 a, uint96 b, string errorMessage) internal pure returns (uint96)
```

### sub96

```solidity
function sub96(uint96 a, uint96 b, string errorMessage) internal pure returns (uint96)
```

### getChainId

```solidity
function getChainId() internal view returns (uint256)
```

### mul96

```solidity
function mul96(uint96 a, uint96 b) internal pure returns (uint96)
```

### mul96

```solidity
function mul96(uint256 a, uint96 b) internal pure returns (uint96)
```

