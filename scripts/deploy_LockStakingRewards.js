const hre = require('hardhat')

const REWARD_TOKEN = process.env.REWARD_TOKEN || '';
const STAKING_TOKEN = process.env.STAKING_TOKEN || '';
const LOCK_DURATION = process.env.LOCK_DURATION || '';

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
    const Contract = await hre.ethers.getContractFactory('LockStakingRewards');
    const contract = await Contract.deployed([
        REWARD_TOKEN,
        STAKING_TOKEN,
        hre.ethers.BigNumber.from(LOCK_DURATION),
    ]);

    console.log(`LockStakingRewards deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(Contract.address, [
        REWARD_TOKEN,
        STAKING_TOKEN,
        hre.ethers.BigNumber.from(LOCK_DURATION),
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
