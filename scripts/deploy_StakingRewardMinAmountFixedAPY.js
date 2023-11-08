const hre = require('hardhat')

const REWARD_TOKEN = process.env.SRMAFA_REWARD_TOKEN || '';
const REWARD_PAYMENT_TOKEN = process.env.SRMAFA_REWARD_TOKEN || '';
const STAKING_TOKEN = process.env.SRMAFA_STAKING_TOKEN || '';
const REWARD_RATE = process.env.SRMAFA_REWARD_RATE || '';
const SWAP_ROUTER = process.env.SRMAFA_SWAP_ROUTER || '';
const SWAP_TOKEN = process.env.SRMAFA_SWAP_TOKEN || '';
const SWAP_TOKEN_AMOUNT = process.env.SRMAFA_SWAP_TOKEN_AMOUNT || '';
const STAKING_PRICE_FEED = process.env.STAKING_PRICE_FEED || '';

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
    const Contract = await hre.ethers.getContractFactory('StakingRewardMinAmountFixedAPY');
    const arguments = [
        REWARD_TOKEN,
        REWARD_PAYMENT_TOKEN,
        STAKING_TOKEN,
        hre.ethers.BigNumber.from(REWARD_RATE),
        SWAP_ROUTER,
        SWAP_TOKEN,
        hre.ethers.BigNumber.from(SWAP_TOKEN_AMOUNT),
    ];
    const contract = await Contract.deployed(arguments);

    console.log(`StakingRewardMinAmountFixedAPY deployed: ${contract.address} by ${deployer.address}`);

    if (STAKING_PRICE_FEED.length === 0) console.log('Skipping price feed setup');
    else {
        console.log('Attaching price feeds')
        await contract.updatePriceFeed(STAKING_PRICE_FEED).then(res=>console.log('Price feed address set'));
        await contract.toggleUsePriceFeeds().then(res=>console.log('Price feed enabled'));
    }

    console.log('Verifying contracts...')
    await ver(Contract.address, arguments);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
