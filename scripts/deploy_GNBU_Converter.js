const hre = require('hardhat')

const CONVERTER_GNBU_TOKEN = process.env.CONVERTER_GNBU_TOKEN || '';
const CONVERTER_GNIMB_TOKEN = process.env.CONVERTER_GNIMB_TOKEN || '';
const INITIAL_HOLDER = process.env.INITIAL_HOLDER || '';

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
    const Contract = await hre.ethers.getContractFactory('ConverterGNBU');
    let contract = await Contract.deploy(
        CONVERTER_GNBU_TOKEN,
        CONVERTER_GNIMB_TOKEN,
        INITIAL_HOLDER
    );

    const contractNew = await contract.deployed()

    console.log(`ConverterGNBU deployed: ${contractNew.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contractNew.address, [
        CONVERTER_GNBU_TOKEN,
        CONVERTER_GNIMB_TOKEN,
        INITIAL_HOLDER
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
