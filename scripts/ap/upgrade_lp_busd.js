const hre = require('hardhat')

const SMARTLP_BUSD_ADDRESS = process.env.SMARTLP_BUSD_AP || '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  ;[deployer] = await hre.ethers.getSigners()

  const contractName = 'contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BUSD_AP.sol:SmartLP_AP';
  smartLP = await hre.ethers.getContractFactory(contractName)

  // await upgrades.forceImport(SMARTLP_BUSD_ADDRESS, smartLP)
  
  smartLPNew = await upgrades.upgradeProxy(SMARTLP_BUSD_ADDRESS, smartLP)
  smartLPNew = await smartLPNew.deployed()
  console.log('SmartLP BUSD upgraded at:', smartLPNew.address)
  
  // if (SLP_PRICE_FEED.length === 0) console.log('Skipping price feed setup');
  //   else {
  //       console.log('Attaching price feeds')
  //       await smartLPNew.updatePriceFeed(SLP_PRICE_FEED).then(res=>console.log('Price feed address set'));
  //       await smartLPNew.updateUsePriceFeeds(true).then(res=>console.log('Price feed rewards enabled'));
  //   }

  // if (GNIMB_TOKEN.length > 0 && GNIMB_BNB_PAIR.length > 0 && GNIMB_BNB_LPSTAKING.length > 0 && SLP_PAYMENT_TOKEN.length > 0 && SLP_NIMB_TOKEN.length > 0) {
  //   await smartLPNew.updateGnimbTokenContract(GNIMB_TOKEN, GNIMB_BNB_PAIR, GNIMB_BNB_LPSTAKING).then(async res=> await res.wait().then(console.log('Gnimb params set')));
  //   await smartLPNew.updateNimbToken(SLP_NIMB_TOKEN).then(async res=> await res.wait().then(console.log('Set NIMB token')));
  //   await smartLPNew.updatePaymentToken(SLP_PAYMENT_TOKEN).then(async res=> await res.wait().then(console.log('Set payment token GNIMB')));
  // }

  console.log('Verifying contracts...')
  const smartLPNewImplAddress = await upgrades.erc1967.getImplementationAddress(smartLPNew.address);
  await ver(smartLPNewImplAddress, [], contractName)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
