const hre = require('hardhat')

const ACP_TARGET = process.env.ACP_TARGET || '';

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
    const Contract = await hre.ethers.getContractFactory('AccessControlProxy');
    let contract = await Contract.deploy(ACP_TARGET);

    const contractNew = await contract.deployed()

    console.log(`AccessControlProxy deployed: ${contractNew.address} for target ${ACP_TARGET} by ${deployer.address}`);

    console.log('Verifying contracts...')
    await ver(contractNew.address, [ACP_TARGET]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
