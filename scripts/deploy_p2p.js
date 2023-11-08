const hre = require('hardhat')

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

  p2p = await hre.ethers.getContractFactory('NimbusP2P_V2')
  
  p2pNew = await upgrades.deployProxy(p2p, [[process.env.NBU_TOKEN, process.env.GNBU_TOKEN], process.env.WBNB])
  p2pNew = await p2pNew.deployed()
  console.log('P2P deployed to:', p2pNew.address)

  console.log('Verifying contracts...')
  const p2pNewImplAddress = await upgrades.erc1967.getImplementationAddress(p2pNew.address);
  await ver(p2pNewImplAddress, [])
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
