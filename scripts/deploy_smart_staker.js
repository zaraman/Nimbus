const hre = require('hardhat')

// SETTINGS

const _nimbusRouter = process.env.NIMBUS_ROUTER
const _pancakeRouter = process.env.PANCAKE_ROUTER
const _nimbusBNB = process.env.NIMBUS_BNB
const _binanceBNB = process.env.BINANCE_BNB
const _nbuToken = process.env.NBU_TOKEN
const _gnbuToken = process.env.GNBU_TOKEN
const _cakeToken = process.env.CAKE_TOKEN
const _lpBnbCake = process.env.LP_BNB_CAKE
const _NbuStaking = process.env.NBU_STAKING
const _GnbuStaking = process.env.GNBU_STAKING
const _CakeStaking = process.env.CAKE_STAKING
const _busdToken = process.env.BUSD_TOKEN

const updateAllowedStakers = true

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ver = async function verifyContracts(address, arguments) {
  await hre
    .run('verify:verify', {
      address: address,
      constructorArguments: arguments,
    })
    .catch((err) => console.log(err))
}

async function main() {
  if (!_NbuStaking || !_GnbuStaking) {
    console.log('Please fill .env with NBU_STAKING and GNBU_STAKING')
    return;
  }
  ;[deployer] = await hre.ethers.getSigners()

  StakingMain = await hre.ethers.getContractFactory('StakingMain')

  HubRouting = await hre.ethers.getContractFactory('HubRouting')
  StakingSet = await hre.ethers.getContractFactory('StakingSet')
  StakingSetBusd = await hre.ethers.getContractFactory('StakingSetBusd')


  console.log('Deploying...')
  StakingMainNew = await StakingMain.deploy(_nimbusBNB)
  StakingMainDeployed = await StakingMainNew.deployed()
  console.log('StakingMain deployed to:', StakingMainDeployed.address)

  HubRoutingNew = await HubRouting.deploy(StakingMainDeployed.address)
  HubRoutingDeployed = await HubRoutingNew.deployed()
  console.log('HubRouting deployed to:', HubRoutingDeployed.address)

  
  StakingSetNew = await upgrades.deployProxy(StakingSet, [
    _nimbusRouter,
    _pancakeRouter,
    _nimbusBNB,
    _binanceBNB,
    _nbuToken,
    _gnbuToken,
    _lpBnbCake,
    _NbuStaking,
    _GnbuStaking,
    _CakeStaking,
    HubRoutingDeployed.address
  ])
  StakingSetDeployed = await StakingSetNew.deployed()
  console.log('StakingSet deployed to:', StakingSetDeployed.address)


  StakingSetBusdNew = await upgrades.deployProxy(StakingSetBusd, [
    _nimbusRouter,
    _pancakeRouter,
    _nimbusBNB,
    _binanceBNB,
    _nbuToken,
    _gnbuToken,
    _busdToken,
    _lpBnbCake,
    _NbuStaking,
    _GnbuStaking,
    _CakeStaking,
    HubRoutingDeployed.address
  ])
  StakingSetBusdDeployed = await StakingSetBusdNew.deployed()
  console.log('StakingSetBusd deployed to:', StakingSetBusdDeployed.address)


  

  await StakingMainDeployed.setHubRouting(HubRoutingDeployed.address)

  

  await StakingMainDeployed.addSet(StakingSetDeployed.address)
  await StakingMainDeployed.addSet(StakingSetBusdDeployed.address)
  
  await StakingSetDeployed.setCakePID(process.env.CAKE_PID)
  await StakingSetBusdDeployed.setCakePID(process.env.CAKE_PID)


  if (updateAllowedStakers) {
    console.log('Update allowed stakers on stakings...')

    nbuStaking = await ethers.getContractAt('StakingRewardsFixedAPY', _NbuStaking)
    await nbuStaking.updateAllowedStaker(StakingSetDeployed.address, true)
    await nbuStaking.updateAllowedStaker(StakingSetBusdDeployed.address, true)

    gnbuStaking = await ethers.getContractAt('StakingRewardsFixedAPY', _GnbuStaking)
    await gnbuStaking.updateAllowedStaker(StakingSetDeployed.address, true)
    await gnbuStaking.updateAllowedStaker(StakingSetBusdDeployed.address, true)
  }

  console.log('Verifying contracts...')
  await ver(HubRoutingDeployed.address, [StakingMainDeployed.address])
  await ver(StakingMainDeployed.address, [_nimbusBNB])

  const StakingSetDeployedImplAddress = await upgrades.erc1967.getImplementationAddress(StakingSetDeployed.address);
  await ver(StakingSetDeployedImplAddress, [])

  const StakingSetBusdDeployedImplAddress = await upgrades.erc1967.getImplementationAddress(StakingSetBusdDeployed.address);
  await ver(StakingSetBusdDeployedImplAddress, [])
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
