const hre = require('hardhat')

const TOKEN = process.env.TOKEN || '';
const REWARD_RATE = process.env.REWARD_RATE || '';

const ver = async function verifyContracts(address, arguments) {
    await hre
        .run('verify:verify', {
            address: address,
            constructorArguments: arguments,
        })
        .catch((err) => console.log(err))
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const Contract = await hre.ethers.getContractFactory('StakingRewardSameTokenFixedAPY');
    const contract = await Contract.deployed([
        TOKEN,
        hre.ethers.BigNumber.from(REWARD_RATE),
    ]);

    console.log(`StakingRewardSameTokenFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(Contract.address, [
        TOKEN,
        hre.ethers.BigNumber.from(REWARD_RATE),
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
