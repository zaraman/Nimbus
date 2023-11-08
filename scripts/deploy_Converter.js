const hre = require('hardhat')

const CONVERTER_PURCHASE_TOKEN = process.env.CONVERTER_PURCHASE_TOKEN || '';
const CONVERTER_RECEIVE_TOKEN = process.env.CONVERTER_RECEIVE_TOKEN || '';

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
    const Contract = await hre.ethers.getContractFactory('Converter');
    let contract = await Contract.deploy(
        CONVERTER_PURCHASE_TOKEN,
        CONVERTER_RECEIVE_TOKEN
    );

    const contractNew = await contract.deployed()

    console.log(`Converter deployed: ${contractNew.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contractNew.address, [
        CONVERTER_PURCHASE_TOKEN,
        CONVERTER_RECEIVE_TOKEN
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
