const hre = require('hardhat')

const SMARTLP_BNB_ADDRESS = process.env.SMARTLP_BNB_AP || '';

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
  console.log('SmartLP New BNB AP Implementation deployed to:', smartLPNew.address)

  console.log('Deploying Smart LP BNB Proxy...')
  smartLPProxy = await hre.ethers.getContractFactory(contractNameProxy)
  smartLPProxyNew = await smartLPProxy.attach(SMARTLP_BNB_ADDRESS);
  await smartLPProxyNew.setTarget(smartLPNew.address)
  .then(async res=> await res.wait().then(console.log('Smart LP BNB setTarget done')));
  console.log('New SmartLP BNB AP Impl:', smartLPNew.address)

  await ver(smartLPNew.address, [], contractName)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
