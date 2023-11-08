const hre = require('hardhat')

// SETTINGS

const _nimbusRouter = process.env.NIMBUS_ROUTER
const _pancakeRouter = process.env.PANCAKE_ROUTER
const _nimbusBNB = process.env.NIMBUS_BNB
const _binanceBNB = process.env.BINANCE_BNB
const _nbuToken = process.env.NBU_TOKEN
const _gnbuToken = process.env.GNBU_TOKEN
// const _cakeToken = process.env.CAKE_TOKEN
const _lpBnbCake = process.env.LP_BNB_CAKE
const _NbuStaking = process.env.NBU_STAKING
const _GnbuStaking = process.env.GNBU_STAKING
const _CakeStaking = process.env.CAKE_STAKING
const _busdToken = process.env.BUSD_TOKEN

const _bpStakingMain = process.env.BP_STAKING_MAIN;
const _bpHubRouting = process.env.BP_HUBROUTING;
const _nimbToken = process.env.SS_NIMB_TOKEN
const _gnimbToken = process.env.SS_GNIMB_TOKEN
const _GnimbStaking = process.env.SS_GNIMB_STAKING
const _NimbStaking = process.env.SS_NIMB_STAKING
const _paymentToken = process.env.SS_PAYMENT_TOKEN
const _priceFeed = process.env.SS_PRICE_FEED

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


  console.log('Attaching StakingMain...')
  // StakingMainNew = await StakingMain.deploy(_nimbusBNB)
  StakingMainDeployed = await StakingMain.attach(_bpStakingMain)
  console.log('StakingMain attached to:', StakingMainDeployed.address)

  console.log('Attaching HubRouting...')
  // HubRoutingNew = await HubRouting.deploy(StakingMainDeployed.address)
  HubRoutingDeployed = await HubRouting.attach(_bpHubRouting)
  console.log('HubRouting attached to:', HubRoutingDeployed.address)

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
  // StakingSetDeployed = await StakingSet.attach('0x657a94a200B1c00F3431ba460d6009A0500eF68c')
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
  // StakingSetBusdDeployed = await StakingSetBusd.attach('0x8dC90b9AF6B59bb9185528716C700e024A762FaD')
  StakingSetBusdDeployed = await StakingSetBusdNew.deployed()
  console.log('StakingSetBusd deployed to:', StakingSetBusdDeployed.address)

  

  await StakingMainDeployed.addSet(StakingSetDeployed.address)
  .then(async res=> await res.wait().then(console.log('BNB Set addSet done')));
  await StakingMainDeployed.addSet(StakingSetBusdDeployed.address)
  .then(async res=> await res.wait().then(console.log('BUSD Set addSet done')));
  
  await StakingSetDeployed.setCakePID(process.env.CAKE_PID)
  .then(async res=> await res.wait().then(console.log('BNB Set setCakePID done')));
  await StakingSetBusdDeployed.setCakePID(process.env.CAKE_PID)
  .then(async res=> await res.wait().then(console.log('BUSD Set setCakePID done')));

  await StakingSetDeployed.setLockTime(process.env.NFT_LOCK_TIME)
  .then(async res=> await res.wait().then(console.log('BNB Set setLockTime done')));
  await StakingSetBusdDeployed.setLockTime(process.env.NFT_LOCK_TIME)
  .then(async res=> await res.wait().then(console.log('BUSD Set setLockTime done')));

  await StakingSetBusdDeployed.updateMinPurchaseAmount(process.env.NFT_BUSD_SS_PURCHASE_MIN)
  .then(async res=> await res.wait().then(console.log('BUSD Set setLockTime done')));

  await StakingSetDeployed.updateGnimbToken(_gnimbToken, _GnimbStaking)
  .then(async res=> await res.wait().then(console.log('BNB Set updateGnimbToken done')));
  await StakingSetDeployed.updateNimbToken(_nimbToken, _NimbStaking)
  .then(async res=> await res.wait().then(console.log('BNB Set updateNimbToken done')));
  await StakingSetDeployed.updatePaymentToken(_paymentToken)
  .then(async res=> await res.wait().then(console.log('BNB Set updatePaymentToken done')));

  await StakingSetBusdDeployed.updateGnimbToken(_gnimbToken, _GnimbStaking)
  .then(async res=> await res.wait().then(console.log('BUSD Set updateGnimbToken done')));
  await StakingSetBusdDeployed.updateNimbToken(_nimbToken, _NimbStaking)
  .then(async res=> await res.wait().then(console.log('BUSD Set updateNimbToken done')));
  await StakingSetBusdDeployed.updatePaymentToken(_paymentToken)
  .then(async res=> await res.wait().then(console.log('BNB Set updatePaymentToken done')));

  await StakingSetDeployed.updatePriceFeed(_priceFeed)
  .then(async res=> await res.wait().then(console.log('BNB Set updatePriceFeed done')));
  await StakingSetDeployed.updateUsePriceFeeds(true)
  .then(async res=> await res.wait().then(console.log('BNB Set updateUsePriceFeeds done')));

  await StakingSetBusdDeployed.updatePriceFeed(_priceFeed)
  .then(async res=> await res.wait().then(console.log('BNB Set updatePriceFeed done')));
  await StakingSetBusdDeployed.updateUsePriceFeeds(true)
  .then(async res=> await res.wait().then(console.log('BUSD Set updateUsePriceFeeds done')));

  if (updateAllowedStakers) {
    console.log('Update allowed stakers on stakings...')

    const nbuStaking = await ethers.getContractAt('StakingRewardFixedAPY_NFT', _NimbStaking)
    await nbuStaking.updateAllowedStaker(StakingSetDeployed.address, true)
    .then(async res=> await res.wait().then(console.log(`BNB Set updateAllowedStaker NIMB done`)));
    await nbuStaking.updateAllowedStaker(StakingSetBusdDeployed.address, true)
    .then(async res=> await res.wait().then(console.log(`BUSD Set updateAllowedStaker NIMB done`)));

    const gnbuStaking = await ethers.getContractAt('StakingRewardFixedAPY_NFT', _GnimbStaking)
    await gnbuStaking.updateAllowedStaker(StakingSetDeployed.address, true)
    .then(async res=> await res.wait().then(console.log(`BNB Set updateAllowedStaker GNIMB done`)));
    await gnbuStaking.updateAllowedStaker(StakingSetBusdDeployed.address, true)
    .then(async res=> await res.wait().then(console.log(`BUSD Set updateAllowedStaker GNIMB done`)));
  }

  console.log('Verifying contracts...')
  // await ver(HubRoutingDeployed.address, [StakingMainDeployed.address])
  // await ver(StakingMainDeployed.address, [_nimbusBNB])

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
