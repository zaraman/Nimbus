const hre = require('hardhat')

const REWARD_DISTRIBUTION = process.env.REWARD_DISTRIBUTION || '';
const REWARD_TOKEN = process.env.REWARD_TOKEN || '';
const STAKING_TOKEN = process.env.STAKING_TOKEN || '';
const REWARD_DATE = process.env.LOCK_DURATION || '';

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
    const Contract = await hre.ethers.getContractFactory('RewardsFactory');
    const contract = await Contract.deployed([
        REWARD_DISTRIBUTION,
        REWARD_TOKEN,
        STAKING_TOKEN,
        hre.ethers.BigNumber.from(REWARD_DATE),
    ]);

    console.log(`RewardsFactory deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(Contract.address, [
        REWARD_DISTRIBUTION,
        REWARD_TOKEN,
        STAKING_TOKEN,
        hre.ethers.BigNumber.from(REWARD_DATE),
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
