const hre = require('hardhat')

const REWARD_TOKEN = process.env.SLFA_REWARD_TOKEN || '';
const REWARD_PAYMENT_TOKEN = process.env.SLFA_REWARD_PAYMENT_TOKEN || '';
const STAKING_LP_TOKEN = process.env.SLFA_STAKING_LP_TOKEN || '';
const LP_PAIR_TOKEN_A = process.env.SLFA_LP_PAIR_TOKEN_A || '';
const LP_PAIR_TOKEN_B = process.env.SLFA_LP_PAIR_TOKEN_B || '';
const SWAP_ROUTER = process.env.SLFA_SWAP_ROUTER || '';
const REWARD_RATE = process.env.SLFA_REWARD_RATE || '';
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
    const contractName = 'contracts/contracts_BSC/Staking/StakingLPRewardFixedAPY.sol:StakingLPRewardFixedAPY';
    const Contract = await hre.ethers.getContractFactory(contractName);
    const arguments = [
        REWARD_TOKEN,
        REWARD_PAYMENT_TOKEN,
        STAKING_LP_TOKEN,
        LP_PAIR_TOKEN_A,
        LP_PAIR_TOKEN_B,
        SWAP_ROUTER,
        REWARD_RATE.toString(),
    ]
    let contract = await Contract.deploy(...arguments);
    contract = await contract.deployed()

    console.log(`StakingLPRewardFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    if (STAKING_PRICE_FEED.length === 0) console.log('Skipping price feed setup');
    else {
        console.log('Attaching price feeds')
        await contract.updatePriceFeed(STAKING_PRICE_FEED).then(res=>console.log('Price feed address set'));
        await contract.updateUsePriceFeeds(true).then(res=>console.log('Price feed rewards disabled'));
        await contract.updateTokenUsePriceFeeds(false, false).then(res=>console.log('Price feed tokenA tokenB disabled'));
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
