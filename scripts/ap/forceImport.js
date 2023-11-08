const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = '0x3f8D1afEa02c32FDc82551DF6503C4873d4b9eB1';

  const contractName = 'contracts/contracts_BSC/Staking/StakingRewardsPayment.sol:StakingRewardsPayment';
  StakingRewardsPayment = await hre.ethers.getContractFactory(contractName)
  console.log('Implementation address: ' + await upgrades.erc1967.getImplementationAddress(proxyAddress));
  console.log('Admin address: ' + await upgrades.erc1967.getAdminAddress(proxyAddress));

  await upgrades.forceImport(proxyAddress, StakingRewardsPayment, { kind: 'transparent' });
}

main();