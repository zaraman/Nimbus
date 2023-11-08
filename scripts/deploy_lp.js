const hre = require('hardhat')

const SWAP_ROUTER = process.env.SWAP_ROUTER || '';
const PANCAKE_ROUTER = process.env.PANCAKE_ROUTER || '';
const WBNB = process.env.WBNB || '';
const PURCHASE_TOKEN = process.env.PURCHASE_TOKEN || '';
const NBU_TOKEN = process.env.NBU_TOKEN || '';
const GNBU_TOKEN = process.env.GNBU_TOKEN || '';
const BNBNBU_PAIR = process.env.BNBNBU_PAIR || '';
const GNBUBNB_PAIR = process.env.GNBUBNB_PAIR || '';
const LPSTAKING_BNBNBU = process.env.LPSTAKING_BNBNBU || '';
const LPSTAKING_BNBGNBU = process.env.LPSTAKING_BNBGNBU || '';

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

  const contractName = 'contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BUSD.sol:SmartLP';
  smartLP = await hre.ethers.getContractFactory(contractName)
  
  smartLPNew = await upgrades.deployProxy(smartLP, [
    SWAP_ROUTER,
    PANCAKE_ROUTER,
    WBNB,
    PURCHASE_TOKEN,
    NBU_TOKEN,
    GNBU_TOKEN,
    BNBNBU_PAIR,
    GNBUBNB_PAIR,
    LPSTAKING_BNBNBU,
    LPSTAKING_BNBGNBU
  ])
  smartLPNew = await smartLPNew.deployed()
  console.log('SmartLP BUSD deployed to:', smartLPNew.address)

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
