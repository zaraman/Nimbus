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

  const contractName = 'contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BNB_AP.sol:SmartLP_AP';
  const contractNameProxy = 'contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BNB_AP.sol:SmartLP_APProxy';

  smartLP = await hre.ethers.getContractFactory(contractName)
  
  smartLPNew = await smartLP.deploy()
  smartLPNew = await smartLPNew.deployed()
  console.log('SmartLP BNB AP Implementation deployed to:', smartLPNew.address)

  console.log('Deploying Smart LP BNB Proxy...')
  smartLPProxy = await hre.ethers.getContractFactory(contractNameProxy)
  smartLPProxyNew = await smartLPProxy.deploy(smartLPNew.address);
  console.log('SmartLP BNB AP Proxy deployed to:', smartLPProxyNew.address)

  console.log('Initializing with attached proxy...');
  SmartLpDeployed = await smartLP.attach(smartLPProxyNew.address)
  await SmartLpDeployed.initialize(
    SWAP_ROUTER,
    SLP_NIMB_TOKEN,
    GNIMB_TOKEN,
    NIMB_BNB_PAIR,
    GNIMB_BNB_PAIR,
    NIMB_BNB_LPSTAKING,
    GNIMB_BNB_LPSTAKING,
    SLP_NIMB_TOKEN,
    SLP_PRICE_FEED
  )
  .then(async res=> await res.wait().then(console.log('Smart LP BNB Init done')));

  console.log('Verifying contracts...')
  await ver(smartLPNew.address, [], contractName)
  await ver(smartLPProxyNew.address, [smartLPNew.address], contractNameProxy)
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
