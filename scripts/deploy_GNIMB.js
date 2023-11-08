const hre = require('hardhat')

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
    const Contract = await hre.ethers.getContractFactory('GNIMB');
    let contract = await Contract.deploy(
    );

    const contractNew = await contract.deployed()

    console.log(`GNIMB deployed: ${contractNew.address} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contractNew.address, [

    ]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
