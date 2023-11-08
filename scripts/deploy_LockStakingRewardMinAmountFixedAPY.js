const hre = require('hardhat')

const REWARD_TOKEN = process.env.LSRMAFA_REWARD_TOKEN || '';
const REWARD_PAYMENT_TOKEN = process.env.LSRMAFA_REWARD_PAYMENT_TOKEN || '';
const STAKING_TOKEN = process.env.LSRMAFA_STAKING_TOKEN || '';
const REWARD_RATE = process.env.LSRMAFA_REWARD_RATE || '';
const LOCK_DURATION = process.env.LSRMAFA_LOCK_DURATION || '';
const SWAP_ROUTER = process.env.LSRMAFA_SWAP_ROUTER || '';
const SWAP_TOKEN = process.env.LSRMAFA_SWAP_TOKEN || '';
const SWAP_TOKEN_AMOUNT = process.env.LSRMAFA_SWAP_TOKEN_AMOUNT || '';

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
    const Contract = await hre.ethers.getContractFactory('LockStakingRewardMinAmountFixedAPY');
    const arguments = [
        REWARD_TOKEN,
        REWARD_PAYMENT_TOKEN,
        STAKING_TOKEN,
        SWAP_ROUTER,
        SWAP_TOKEN,
        hre.ethers.BigNumber.from(SWAP_TOKEN_AMOUNT),
        hre.ethers.BigNumber.from(REWARD_RATE),
        hre.ethers.BigNumber.from(LOCK_DURATION)
    ];
    const contract = await Contract.deployed(arguments);

    console.log(`LockStakingRewardMinAmountFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(Contract.address, arguments);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
