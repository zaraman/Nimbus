const hre = require('hardhat')

const SWAP_ROUTER = process.env.PFSM_SWAP_ROUTER || '';
const PRICE_FEED = process.env.PFSM_PRICE_FEED || '';
const BASE_TOKEN = process.env.PFSM_BASE_TOKEN || '';
const NBU = process.env.PFSM_NBU || '';
const NIMB = process.env.PFSM_NIMB || '';
const WBNB_AP = process.env.PFSM_WBNB_AP || '';
const BUSD = process.env.PFSM_BUSD || '';
const GNIMB = process.env.PF_GNIMB_TOKEN || '';

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
    const contractName = 'contracts/contracts_BSC/dApps/RevenueChannels/feeds/PriceFeedSwapModifier.sol:PriceFeedSwapModifier';
    const Contract = await hre.ethers.getContractFactory(contractName);
    const arguments = [
        SWAP_ROUTER,
        PRICE_FEED,
        BASE_TOKEN
    ];

    let contract = await Contract.deploy(...arguments);
    contract = await contract.deployed();

    console.log(`PriceFeedSwapModifier deployed: ${contract.address} by ${deployer.address}`);

    console.log('Set up contract')

    await contract.setUsePriceFeedForToken(BUSD, true).then(async res=> await res.wait().then(console.log('Price feed enabled for BUSD')));
    await contract.setUseBNBSwapForTokens(NIMB,GNIMB, true).then(async res=> await res.wait().then(console.log('Price feed enabled for BUSD')));

    if (WBNB_AP.toLocaleLowerCase() !== BASE_TOKEN.toLocaleLowerCase()) {
        await contract.setTokenAlias(WBNB_AP, BASE_TOKEN).then(async res=> await res.wait().then(console.log('Swap alias for WBNB_AP -> BASE_TOKEN')));
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
