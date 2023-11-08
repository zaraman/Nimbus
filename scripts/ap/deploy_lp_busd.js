const hre = require('hardhat')

const SWAP_ROUTER = process.env.SWAP_ROUTER || '';
const PANCAKE_ROUTER = process.env.PANCAKE_ROUTER || '';
const PURCHASE_TOKEN = process.env.PURCHASE_TOKEN || '';
const GNIMB_TOKEN = process.env.SLP_GNIMB_TOKEN || '';
const GNIMB_BNB_PAIR = process.env.SLP_GNIMB_BNB_PAIR || '';
const GNIMB_BNB_LPSTAKING = process.env.SLP_GNIMB_BNB_LPSTAKING || '';
const SLP_PRICE_FEED = process.env.SLP_PRICE_FEED || '';
const SLP_NIMB_TOKEN = process.env.SLP_NIMB_TOKEN || '';
const NIMB_BNB_PAIR = process.env.SLP_NIMB_BNB_PAIR || '';
const NIMB_BNB_LPSTAKING = process.env.SLP_NIMB_BNB_LPSTAKING || '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ver = async function verifyContracts(address, arguments, contract) {
  await hre
      .run('verify:verify', {
          address: address,
          constructorArguments: arguments,
          contract
      })
      .catch((err) => console.log(err))
}

async function main() {
  ;[deployer] = await hre.ethers.getSigners()

  const contractName = 'contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BUSD_AP.sol:SmartLP_AP';
  smartLP = await hre.ethers.getContractFactory(contractName)
  
  smartLPNew = await upgrades.deployProxy(smartLP, [
    SWAP_ROUTER,
    PANCAKE_ROUTER,
    PURCHASE_TOKEN,
    SLP_NIMB_TOKEN,
    GNIMB_TOKEN,
    NIMB_BNB_PAIR,
    GNIMB_BNB_PAIR,
    NIMB_BNB_LPSTAKING,
    GNIMB_BNB_LPSTAKING,
    SLP_PRICE_FEED
  ])
  smartLPNew = await smartLPNew.deployed()
  console.log('SmartLP BUSD AP deployed to:', smartLPNew.address)

  console.log('Verifying contracts...')
  const smartLPNewImplAddress = await upgrades.erc1967.getImplementationAddress(smartLPNew.address);
  await ver(smartLPNewImplAddress, [], contractName)
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
