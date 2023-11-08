# Solidity API

## ILockStakingRewardFixedAPY

### StakeNonceInfo

```solidity
struct StakeNonceInfo {
  uint256 unlockTime;
  uint256 stakeTime;
  uint256 stakingTokenAmount;
  uint256 rewardsTokenAmount;
  uint256 rewardRate;
}
```

### getTokenAmountForToken

```solidity
function getTokenAmountForToken(address tokenSrc, address tokenDest, uint256 tokenAmount) external view returns (uint256)
```

### stakeNonceInfos

```solidity
function stakeNonceInfos(address user, uint256 nonce) external view returns (struct ILockStakingRewardFixedAPY.StakeNonceInfo)
```

### stakeNonces

```solidity
function stakeNonces(address user) external view returns (uint256)
```

### rewardsToken

```solidity
function rewardsToken() external view returns (contract IERC20Upgradeable)
```

### rewardDuration

```solidity
function rewardDuration() external view returns (uint256)
```

### usePriceFeeds

```solidity
function usePriceFeeds() external view returns (bool)
```

### getRewardForUser

```solidity
function getRewardForUser(address user) external
```

### earned

```solidity
function earned(address account) external view returns (uint256)
```

### earnedByNonce

```solidity
function earnedByNonce(address account, uint256 nonce) external view returns (uint256)
```

## NimbusInitialAcquisition

### stakingPools

```solidity
function stakingPools(uint256 stakingId) external view returns (contract ILockStakingRewardFixedAPY)
```

## StakingRewardsPayment

This contract is used to pay rewards for staking with custom rules

### stakeTime

```solidity
mapping(address => mapping(address => mapping(uint256 => uint256))) stakeTime
```

### allowedStakings

```solidity
mapping(address => bool) allowedStakings
```

### affiliateContract

```solidity
address affiliateContract
```

### Rescue

```solidity
event Rescue(address to, uint256 amount)
```

### RescueToken

```solidity
event RescueToken(address to, address token, uint256 amount)
```

### onlyAllowedStakings

```solidity
modifier onlyAllowedStakings(contract ILockStakingRewardFixedAPY stakingPool)
```

### initialize

```solidity
function initialize() public
```

### earnedByNonce

```solidity
function earnedByNonce(address account, uint256 nonce, contract ILockStakingRewardFixedAPY stakingPool) public view returns (uint256)
```

_calculate earned rewards for user by single nonces_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |
| nonce | uint256 | nonce of stake |
| stakingPool | contract ILockStakingRewardFixedAPY | address of staking pool |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | totalEarned total earned rewards |

### earnedByNonceBatch

```solidity
function earnedByNonceBatch(address account, uint256[] nonces, contract ILockStakingRewardFixedAPY stakingPool) public view returns (uint256 totalEarned)
```

_calculate earned rewards for user by multiple nonces_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |
| nonces | uint256[] | array of nonces |
| stakingPool | contract ILockStakingRewardFixedAPY | address of staking pool |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalEarned | uint256 | total earned rewards |

### earned

```solidity
function earned(address account, contract ILockStakingRewardFixedAPY stakingPool) public view returns (uint256 totalEarned)
```

_calculate earned rewards for user_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | address of user |
| stakingPool | contract ILockStakingRewardFixedAPY | address of staking pool |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalEarned | uint256 | total earned rewards |

### getReward

```solidity
function getReward(contract ILockStakingRewardFixedAPY stakingPool) public
```

_withdraw staking rewards for caller_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| stakingPool | contract ILockStakingRewardFixedAPY | address of staking pool |

### getRewardForUser

```solidity
function getRewardForUser(address user, contract ILockStakingRewardFixedAPY stakingPool) public
```

_withdraw staking rewards for user, can be called only by affiliate contract or owner_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of user |
| stakingPool | contract ILockStakingRewardFixedAPY | address of staking pool |

### getAllStakingRewards

```solidity
function getAllStakingRewards(uint256[] stakingIds) public
```

_get staking rewards from multiple contracts at once_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| stakingIds | uint256[] | array of staking ids from affiliate contract |

### updateAllowedStakings

```solidity
function updateAllowedStakings(address staking, bool isActive) external
```

_update allowed staking_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staking | address | address of the staking |
| isActive | bool | is staking active |

### setAffiliateContract

```solidity
function setAffiliateContract(address _affiliateContract) external
```

_set affiliate contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _affiliateContract | address | address of the affiliate contract |

### setPaused

```solidity
function setPaused(bool _paused) external
```

_Change the paused state of the contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _paused | bool | new paused state |

### rescueERC20

```solidity
function rescueERC20(address to, contract IERC20Upgradeable token, uint256 amount) external
```

_Rescue tokens from the contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | address to send tokens to |
| token | contract IERC20Upgradeable | address of the token to send |
| amount | uint256 | amount of tokens to send |

