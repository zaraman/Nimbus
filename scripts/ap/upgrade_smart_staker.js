const { upgrades } = require('hardhat')
const hre = require('hardhat')

// SETTINGS

const StakingSetBusdAddress = process.env.SS_BUSD_SET
const StakingSetAddress = process.env.SS_BNB_SET
const _nimbToken = process.env.SS_NIMB_TOKEN
const _gnimbToken = process.env.SS_GNIMB_TOKEN
const _NimbStaking = process.env.SS_NIMB_STAKING
const _paymentToken = process.env.SS_PAYMENT_TOKEN
const _priceFeed = process.env.SS_PRICE_FEED

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
  ;[deployer] = await hre.ethers.getSigners()

  if (!StakingSetBusdAddress || !StakingSetAddress) {
    console.log('No StakingSets address')
    return;
  }

  // StakingMain = await hre.ethers.getContractFactory('StakingMain')

  // HubRouting = await hre.ethers.getContractFactory('HubRouting')
  // StakingSet = await hre.ethers.getContractFactory('StakingSet')
  StakingSetBusd = await hre.ethers.getContractFactory('StakingSetBusd')
  StakingSet = await hre.ethers.getContractFactory('StakingSet')
  // await upgrades.forceImport(StakingSetBusdAddress, StakingSetBusd)
  // await upgrades.forceImport(StakingSetAddress, StakingSet)

  const StakingSetBusdDeployed = await upgrades.upgradeProxy(
    StakingSetBusdAddress,
    StakingSetBusd,
  )

  

  const StakingSetDeployed = await upgrades.upgradeProxy(
    StakingSetAddress,
    StakingSet,
  )

  // await StakingSetDeployed.updateNimbToken(_nimbToken, _NimbStaking).then(async res=> await res.wait().then(console.log('Nimb BUSD set')));
  // await StakingSetDeployed.updateNimbToken(_nimbToken)
  // await StakingSetDeployed.updatePaymentToken(_paymentToken).then(async res=> await res.wait().then(console.log('Payment token switched to NIMB for BNB')));

  // await StakingSetBusdDeployed.updateNimbToken(_nimbToken, _NimbStaking).then(async res=> await res.wait().then(console.log('Nimb BNB SET')));
  // await StakingSetBusdDeployed.updateNimbToken(_nimbToken)
  // await StakingSetBusdDeployed.updatePaymentToken(_paymentToken).then(async res=> await res.wait().then(console.log('Payment token switched to NIMB for BUSD')));

  // await StakingSetDeployed.updatePriceFeed(_priceFeed)
  // await StakingSetDeployed.updateUsePriceFeeds(true).then(async res=> await res.wait().then(console.log('PriceFeed BUSD disabled')));

  // await StakingSetBusdDeployed.updatePriceFeed(_priceFeed)
  // await StakingSetBusdDeployed.updateUsePriceFeeds(true).then(async res=> await res.wait().then(console.log('PriceFeed BNB disabled')));

  console.log('Upgraded contract with new implementation')

  const StakingSetBusdDeployedImplAddress = await upgrades.erc1967.getImplementationAddress(StakingSetBusdAddress);
  await ver(StakingSetBusdDeployedImplAddress, [])


  const StakingSetDeployedImplAddress = await upgrades.erc1967.getImplementationAddress(StakingSetAddress);
  await ver(StakingSetDeployedImplAddress, [])
  
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
