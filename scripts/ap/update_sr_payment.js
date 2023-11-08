const hre = require('hardhat')

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const STAKINGREWARDSPAYMENT_ADDRESS = process.env.STAKINGREWARDSPAYMENT_ADDRESS || '';

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

    const contractName = 'contracts/contracts_BSC/Staking/StakingRewardsPayment.sol:StakingRewardsPayment';
    StakingRewardsPayment = await hre.ethers.getContractFactory(contractName)

    StakingRewardsPaymentNew = await upgrades.upgradeProxy(STAKINGREWARDSPAYMENT_ADDRESS,StakingRewardsPayment)
    StakingRewardsPaymentNew = await StakingRewardsPaymentNew.deployed()
    console.log('StakingRewardsPayment upgraded at:', StakingRewardsPaymentNew.address)

    console.log('Verifying contracts...')
    const StakingRewardsPaymentNewImplAddress = await upgrades.erc1967.getImplementationAddress(StakingRewardsPaymentNew.address);
    await ver(StakingRewardsPaymentNewImplAddress, [], contractName)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
