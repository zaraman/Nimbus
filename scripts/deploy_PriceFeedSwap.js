const hre = require('hardhat')

const NIMBUS_ROUTER = process.env.PF_NIMBUS_ROUTER || '';
const SWAP_TOKEN = process.env.PF_SWAP_TOKEN || '';
const WBNB = process.env.PF_NIMBUS_BNB || '';

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
    const contractName = 'contracts/contracts_BSC/dApps/RevenueChannels/feeds/PriceFeedSwap.sol:PriceFeedSwap';
    const Contract = await hre.ethers.getContractFactory(contractName);
    const arguments = [
        NIMBUS_ROUTER, [SWAP_TOKEN, WBNB]
    ];

    let contract = await Contract.deploy(...arguments);
    contract = await contract.deployed();

    console.log(`PriceFeedSwap deployed: ${contract.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contract.address, arguments, contractName);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
