const hre = require('hardhat')
const { signDaiPermit,signERC2612Permit } = require ("../utils/eth-permit");
const { ethers, upgrades, waffle } = require("hardhat");
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
  const provider = waffle.provider;
  const result = await signERC2612Permit(provider, "0x5f20559235479F5B6abb40dFC6f55185b74E7b55", deployer.address,"0xfA0e7611F62936006379848441eF434303e9f384","10000000000000000000","1");
  console.log(result)
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
