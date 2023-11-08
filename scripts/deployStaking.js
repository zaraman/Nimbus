const hre = require('hardhat')

// SETTINGS

const _nimbusRouter = process.env.SS_NIMBUS_ROUTER
// const _nbuToken = process.env.NBU_TOKEN
const _nimbToken = process.env.SS_NIMB_TOKEN
const _gnimbToken = process.env.SS_GNIMB_TOKEN
const _priceFeed = process.env.SS_PRICE_FEED
const REWARD_RATE = 60


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

  Staking = await hre.ethers.getContractFactory('StakingRewardFixedAPY_NFT')

  GnbuStakingNew = await Staking.deploy(_nimbToken, _gnimbToken, _gnimbToken, _nimbusRouter, REWARD_RATE)
  GnbuStakingDeployed = await GnbuStakingNew.deployed()
  console.log('GnbuStaking deployed to:', GnbuStakingDeployed.address)
  
  console.log('Setting up price feeds for GNbuStaking...')
  await GnbuStakingDeployed.updatePriceFeed(_priceFeed)
  await (await GnbuStakingDeployed.updateUsePriceFeeds(true)).wait()

  console.log('Verifying contracts...')
  await ver(GnbuStakingDeployed.address, [_nimbToken, _gnimbToken, _gnimbToken, _nimbusRouter, REWARD_RATE])
  //await ver(NbuStakingDeployed.address, [_nbuToken, _nbuToken, _nimbusRouter, REWARD_RATE])
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
