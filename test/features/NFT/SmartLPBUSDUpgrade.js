const { expect } = require("chai");
const { ethers, network,upgrades} = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

function calculateRewards(stakeTimestamp, checkTimestamp, equivalent, apr) {
    return new BigNumber.from(equivalent).mul(new BigNumber.from(checkTimestamp).sub(new BigNumber.from(stakeTimestamp))).mul(apr).div(new BigNumber.from(YEAR_IN_SEC).mul(100))
}

const YEAR_IN_SEC = 365 * 24 * 60 * 60;
const SMART_LP_MAINNET = "0x84B9e5BA5683639cb328D4c84bA8389ec66f9205";
const BUSD_MAINNET ="0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
let smartLPOwner;
let ProxySmartLP;
let BUSD;
let SmartLPOld;
let SmartLPNew;
let LPStakingBNBNIMB;
let LPStakingBNBGNIMB;

let oldTokenId;
let newTokenId;

describe("Smart LP BUSD APR Upgrade", function () {
before(async function () {
    [owner, other, user2, ...accounts] = await ethers.getSigners();

    // Smart LP BUSD
    SmartLPOld = await ethers.getContractFactory('contracts/mocks/Old_SmartLPBUSD.sol:SmartLP');
    ProxySmartLP = SmartLPOld.attach(SMART_LP_MAINNET);
    BUSDADDRESS = await ethers.getContractFactory('contracts/mocks/BUSD.sol:BEP20Token');
    BUSD = BUSDADDRESS.attach(BUSD_MAINNET);
    console.log(`Attached ${SMART_LP_MAINNET} as Smart LP BUSD OLD`)
    console.log(`Attached ${BUSD_MAINNET} as BUSD Mainnet`)
    smartLPOwner = await ProxySmartLP.owner();

    await helpers.impersonateAccount("0xf018fc651e8be8a2e09b216635aee561ce3c5ff7");
    const impersonatedSigner = await ethers.getSigner("0xf018fc651e8be8a2e09b216635aee561ce3c5ff7");
    SmartLPNew = await ethers.getContractFactory('contracts/contracts_BSC/dApps/NFTTokens/SmartLP_BUSD.sol:SmartLP',impersonatedSigner);
    await owner.sendTransaction({
        to: impersonatedSigner.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
    });
    
    LPStakingFactory = await ethers.getContractFactory('contracts/contracts_BSC/Staking/StakingLPRewardFixedAPY.sol:StakingLPRewardFixedAPY');
    const lpStakingBnbNimbAddress = await ProxySmartLP.lpStakingBnbNimb();
    const lpStakingBnbGnimbAddress = await ProxySmartLP.lpStakingBnbGnimb();
    LPStakingBNBNIMB = LPStakingFactory.attach(lpStakingBnbNimbAddress)
    console.log(`Attached ${lpStakingBnbNimbAddress} as LPStakingBNBNIMB`)
    LPStakingBNBGNIMB = LPStakingFactory.attach(lpStakingBnbGnimbAddress)
    console.log(`Attached ${lpStakingBnbGnimbAddress} as LPStakingBNBGNIMB`)
});

it("should purchase SmartLP with 100% APR", async function () {
    const BUSDOWNERADDRESS = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
    const tokenCountBefore = await ProxySmartLP.tokenCount();
    await helpers.impersonateAccount(BUSDOWNERADDRESS);
    const impersonatedSigner = await ethers.getSigner(BUSDOWNERADDRESS);
    await BUSD.connect(impersonatedSigner).approve(ProxySmartLP.address,"1000000000000000000000");
    await ProxySmartLP.connect(impersonatedSigner).buySmartLPforToken("1000000000000000000000");
    await helpers.stopImpersonatingAccount(BUSDOWNERADDRESS)

    oldTokenId = await ProxySmartLP.tokenCount();
    console.log(`Purchased NFT ${oldTokenId}, token count changed from ${tokenCountBefore}`)

    expect(oldTokenId).to.equal(+tokenCountBefore + 1)
});

it("should have valid 100% APR rewards", async function () {
    let tikSupplies = await ProxySmartLP.tikSupplies(oldTokenId);
    const nbuBnbStakeNonce = tikSupplies.NbuBnbStakeNonce;
    const gnbuBnbStakeNonce = tikSupplies.GnbuBnbStakeNonce;
    const stakeTimestamp = await ProxySmartLP.weightedStakeDate(oldTokenId);

    const NimbBNBLPStakeNonceInfos = await LPStakingBNBNIMB.stakeNonceInfos(SMART_LP_MAINNET, nbuBnbStakeNonce);
    const GnimbBNBLPStakeNonceInfos = await LPStakingBNBGNIMB.stakeNonceInfos(SMART_LP_MAINNET, gnbuBnbStakeNonce);

    const NimbBNBEquivalent = NimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    const GnimbBNBEquivalent = GnimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    console.log(`Staked ${utils.formatEther(tikSupplies.NbuBnbLpAmount)} NIMB_BNB as equivalent ${utils.formatEther(NimbBNBEquivalent)} NIMB`);
    console.log(`Staked ${utils.formatEther(tikSupplies.GnbuBnbLpAmount)} GNIMB_BNB as equivalent ${utils.formatEther(GnimbBNBEquivalent)} NIMB`);
    
    await helpers.time.increase(YEAR_IN_SEC)

    const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 100);
    console.log(`Calculated NIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 100);
    console.log(`Calculated GNIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(oldTokenId)
    console.log(`Rewards after 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`Rewards after 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);
})

it("should upgrade Smart LP to new APR 45%", async function () {
    await upgrades.forceImport(SMART_LP_MAINNET, SmartLPOld);
    const proxied_SmartLP_new = await upgrades.upgradeProxy(
        SMART_LP_MAINNET,
        SmartLPNew,
    )


    ProxySmartLP = SmartLPNew.attach(SMART_LP_MAINNET);
});

it("should purchase Smart LP after upgrade", async function () {
    const BUSDOWNERADDRESS = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
    newTokenId = await ProxySmartLP.tokenCount();
    await helpers.impersonateAccount(BUSDOWNERADDRESS);
    const impersonatedSigner = await ethers.getSigner(BUSDOWNERADDRESS);
    await BUSD.connect(impersonatedSigner).approve(ProxySmartLP.address,"1000000000000000000000");
    await ProxySmartLP.connect(impersonatedSigner).buySmartLPforToken("1000000000000000000000");
    await helpers.stopImpersonatingAccount(BUSDOWNERADDRESS)

    newTokenId = await ProxySmartLP.tokenCount();
    console.log(`Purchased NFT ${newTokenId}, token count changed from ${oldTokenId}`)

    expect(newTokenId).to.equal(+oldTokenId + 1)
    expect(await ProxySmartLP.afterLPUpdate(newTokenId)).to.equal(true);
    expect(await ProxySmartLP.afterLPUpdate(oldTokenId)).to.equal(false); 
})

it("should have valid 100% APR rewards for old NFT after upgrade", async function () {
    let tikSupplies = await ProxySmartLP.tikSupplies(oldTokenId);
    const nbuBnbStakeNonce = tikSupplies.NbuBnbStakeNonce;
    const gnbuBnbStakeNonce = tikSupplies.GnbuBnbStakeNonce;
    const stakeTimestamp = await ProxySmartLP.weightedStakeDate(oldTokenId);

    const NimbBNBLPStakeNonceInfos = await LPStakingBNBNIMB.stakeNonceInfos(SMART_LP_MAINNET, nbuBnbStakeNonce);
    const GnimbBNBLPStakeNonceInfos = await LPStakingBNBGNIMB.stakeNonceInfos(SMART_LP_MAINNET, gnbuBnbStakeNonce);

    const NimbBNBEquivalent = NimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    const GnimbBNBEquivalent = GnimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    
    const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 100);
    console.log(`Calculated NIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 100);
    console.log(`Calculated GNIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(oldTokenId)
    console.log(`New NFT Rewards after 2 * 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`New NFT Rewards after 2 * 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);

})
it("should have valid 45% APR rewards for new NFT after upgrade", async function () {
    let tikSupplies = await ProxySmartLP.tikSupplies(newTokenId);
    const nbuBnbStakeNonce = tikSupplies.NbuBnbStakeNonce;
    const gnbuBnbStakeNonce = tikSupplies.GnbuBnbStakeNonce;  
    const stakeTimestamp = await ProxySmartLP.weightedStakeDate(newTokenId);

    const NimbBNBLPStakeNonceInfos = await LPStakingBNBNIMB.stakeNonceInfos(SMART_LP_MAINNET, nbuBnbStakeNonce);
    const GnimbBNBLPStakeNonceInfos = await LPStakingBNBGNIMB.stakeNonceInfos(SMART_LP_MAINNET, gnbuBnbStakeNonce);

    const NimbBNBEquivalent = NimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    const GnimbBNBEquivalent = GnimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    console.log(`Staked ${utils.formatEther(tikSupplies.NbuBnbLpAmount)} NIMB_BNB as equivalent ${utils.formatEther(NimbBNBEquivalent)} NIMB`);
    console.log(`Staked ${utils.formatEther(tikSupplies.GnbuBnbLpAmount)} GNIMB_BNB as equivalent ${utils.formatEther(GnimbBNBEquivalent)} NIMB`);
    
    await helpers.time.increase(YEAR_IN_SEC)

    const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 45);
    console.log(`Calculated NIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 45);
    console.log(`Calculated GNIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(newTokenId)
    console.log(`New NFT Rewards after 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`New NFT Rewards after 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);
})
});
