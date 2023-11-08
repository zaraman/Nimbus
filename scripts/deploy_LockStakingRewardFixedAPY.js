const hre = require('hardhat')

const REWARD_TOKEN = process.env.LSRFA_REWARD_TOKEN || '';
const REWARD_PAYMENT_TOKEN = process.env.LSRFA_REWARD_PAYMENT_TOKEN || '';
const STAKING_TOKEN = process.env.LSRFA_STAKING_TOKEN || '';
const SWAP_ROUTER = process.env.LSRFA_SWAP_ROUTER || '';
const REWARD_RATE = process.env.LSRFA_REWARD_RATE || '';
const LOCK_DURATION = process.env.LSRFA_LOCK_DURATION || '';
const STAKING_PRICE_FEED = process.env.STAKING_PRICE_FEED || '';

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
    const [deployer] = await hre.ethers.getSigners();
    const contractName = 'contracts/contracts_BSC/Staking/LockStakingRewardFixedAPY.sol:LockStakingRewardFixedAPY';
    const Contract = await hre.ethers.getContractFactory(contractName);
    const arguments = [
        REWARD_TOKEN,
        REWARD_PAYMENT_TOKEN,
        STAKING_TOKEN,
        SWAP_ROUTER,
        REWARD_RATE.toString(),
        LOCK_DURATION.toString(),
    ];

    let contract = await Contract.deploy(...arguments);
    contract = await contract.deployed();

    console.log(`LockStakingRewardFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    if (STAKING_PRICE_FEED.length === 0) console.log('Skipping price feed setup');
    else {
        console.log('Attaching price feeds')
        await contract.updatePriceFeed(STAKING_PRICE_FEED).then(res=>console.log('Price feed address set'));
        await contract.updateUsePriceFeeds(true).then(res=>console.log('Price feed rewards enabled'));
    }

    console.log('Verifying contracts...')
    await ver(contract.address, arguments, contractName);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
