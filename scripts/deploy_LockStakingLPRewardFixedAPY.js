const hre = require('hardhat')

const REWARD_TOKEN = process.env.REWARD_TOKEN || '';
const STAKING_LP_TOKEN = process.env.STAKING_LP_TOKEN || '';
const LP_PAIR_TOKEN_A = process.env.LP_PAIR_TOKEN_A || '';
const LP_PAIR_TOKEN_B = process.env.LP_PAIR_TOKEN_B || '';
const SWAP_ROUTER = process.env.SWAP_ROUTER || '';
const REWARD_RATE = process.env.REWARD_RATE || '';
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
    const Contract = await hre.ethers.getContractFactory('LockStakingLPRewardFixedAPY');
    const contract = await Contract.deployed([
        REWARD_TOKEN,
        STAKING_LP_TOKEN,
        LP_PAIR_TOKEN_A,
        LP_PAIR_TOKEN_B,
        SWAP_ROUTER,
        hre.ethers.BigNumber.from(REWARD_RATE),
        hre.ethers.BigNumber.from(LOCK_DURATION),
    ]);

    console.log(`LockStakingLPRewardFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(Contract.address, [
        REWARD_TOKEN,
        STAKING_LP_TOKEN,
        LP_PAIR_TOKEN_A,
        LP_PAIR_TOKEN_B,
        SWAP_ROUTER,
        hre.ethers.BigNumber.from(REWARD_RATE),
        hre.ethers.BigNumber.from(LOCK_DURATION),
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
