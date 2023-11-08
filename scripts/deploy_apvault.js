const hre = require("hardhat");

const ver = async function verifyContracts(address, arguments) {
  await hre
    .run("verify:verify", {
      address: address,
      constructorArguments: arguments,
    })
    .catch((err) => console.log(err));
};

async function main() {
  [deployer] = await hre.ethers.getSigners();

  APVault = await hre.ethers.getContractFactory("APVault");

  APVaultnew = await upgrades.deployProxy(APVault, [
    process.env.PURCHASETOKEN,
    process.env.BUSD_CONTRACT,
    [
      process.env.RECEIVED_CONTRACT1,
      process.env.RECEIVED_CONTRACT2,
      process.env.RECEIVED_CONTRACT3,
      process.env.RECEIVED_CONTRACT4,
      process.env.RECEIVED_CONTRACT5
    ],
    process.env.NIMBPROXY,
    process.env.NIMB_ROUTER,
    process.env.PANCAKEROUTER,
  ]);
  APVaultnew = await APVaultnew.deployed();
  console.log("APVault deployed to:", APVaultnew.address);

  console.log("Verifying contracts...");
  const APVaultNewImplAddress = await upgrades.erc1967.getImplementationAddress(
    APVaultnew.address
  );
  await ver(APVaultNewImplAddress, []);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
