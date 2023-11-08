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

    StakingRewardsPayment = await hre.ethers.getContractFactory("contracts/contracts_BSC/Staking/StakingRewardsPayment.sol:StakingRewardsPayment");
    

    StakingRewardsPaymentnew = await upgrades.deployProxy(StakingRewardsPayment);
    StakingRewardsPaymentnew = await StakingRewardsPaymentnew.deployed();
    console.log("========>>>>>>> StakingRewardsPayment deployed to:", StakingRewardsPaymentnew.address);

    console.log("Verifying contracts...");
    const StakingRewardsPaymentNewImplAddress = await upgrades.erc1967.getImplementationAddress(
        StakingRewardsPaymentnew.address
    );
    await ver(StakingRewardsPaymentNewImplAddress, []);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
