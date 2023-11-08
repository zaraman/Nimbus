const hre = require('hardhat')

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

  const contractName = 'contracts/contracts_BSC/AffiliateProgram-3.1/APVault.sol:APVault';
  ApVault = await hre.ethers.getContractFactory(contractName)

  // await upgrades.forceImport(SMARTLP_BUSD_ADDRESS, smartLP)
  
  ApVaultNew = await upgrades.upgradeProxy("0x65b613177A08bf3c885f27E410BE4ec168420993", ApVault)
  ApVaultNew = await ApVaultNew.deployed()
  console.log('APVault upgraded at:', ApVaultNew.address)
  
  console.log('Verifying contracts...')
  const ApVaultNewImplAddress = await upgrades.erc1967.getImplementationAddress(ApVaultNew.address);
  await ver(ApVaultNewImplAddress, [], contractName)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
