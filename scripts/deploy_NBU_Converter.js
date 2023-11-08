const hre = require('hardhat')

const CONVERTER_NBU_TOKEN = process.env.CONVERTER_NBU_TOKEN || '';
const CONVERTER_NIMB_TOKEN = process.env.CONVERTER_NIMB_TOKEN || '';

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
    const Contract = await hre.ethers.getContractFactory('ConverterNBU');
    let contract = await Contract.deploy(
        CONVERTER_NBU_TOKEN,
        CONVERTER_NIMB_TOKEN
    );

    const contractNew = await contract.deployed()

    console.log(`ConverterNBU deployed: ${contractNew.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contractNew.address, [
        CONVERTER_NBU_TOKEN,
        CONVERTER_NIMB_TOKEN
    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
