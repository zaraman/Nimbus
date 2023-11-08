const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

function calculateRewards(stakeTimestamp, checkTimestamp, equivalent, apr) {
    return new BigNumber.from(equivalent).mul(new BigNumber.from(checkTimestamp).sub(new BigNumber.from(stakeTimestamp))).mul(apr).div(new BigNumber.from(YEAR_IN_SEC).mul(100))
}

const YEAR_IN_SEC = 365 * 24 * 60 * 60;
const SMART_LP_MAINNET = "0x4032E41eAbe002f5e4b28d3B47A8E23660b09e6D";

let smartLPOwner;
let ProxySmartLP;

let SmartLPOld;
let SmartLPNew;
let LPStakingBNBNIMB;
let LPStakingBNBGNIMB;
let TokenId10;
let oldTokenId;
let newTokenId;

describe("Smart LP BNB APR Upgrade", function () {
  before(async function () {
    [owner, other, user2, ...accounts] = await ethers.getSigners();

    // Smart LP BNB
    SmartLPOld = await ethers.getContractFactory('contracts/mocks/Old_SmartLP.sol:SmartLP');
    ProxySmartLP = SmartLPOld.attach(SMART_LP_MAINNET);
    console.log(`Attached ${SMART_LP_MAINNET} as Smart LP BNB OLD`)
    smartLPOwner = await ProxySmartLP.owner();

    SmartLPNew = await ethers.getContractFactory('contracts/contracts_BSC/dApps/NFTTokens/SmartLP.sol:SmartLP');
    
    LPStakingFactory = await ethers.getContractFactory('contracts/contracts_BSC/Staking/StakingLPRewardFixedAPY.sol:StakingLPRewardFixedAPY');
    const lpStakingBnbNimbAddress = await ProxySmartLP.lpStakingBnbNimb();
    const lpStakingBnbGnimbAddress = await ProxySmartLP.lpStakingBnbGnimb();
    LPStakingBNBNIMB = LPStakingFactory.attach(lpStakingBnbNimbAddress)
    console.log(`Attached ${lpStakingBnbNimbAddress} as LPStakingBNBNIMB`)
    LPStakingBNBGNIMB = LPStakingFactory.attach(lpStakingBnbGnimbAddress)
    console.log(`Attached ${lpStakingBnbGnimbAddress} as LPStakingBNBGNIMB`)


  });

  it("should purchase SmartLP with 100% APR", async function () {
    const tokenCountBefore = await ProxySmartLP.tokenCount();
    await ProxySmartLP.buySmartLP({ value: ethers.utils.parseUnits("1.0") });
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
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 45);
    console.log(`Calculated NIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 45);
    console.log(`Calculated GNIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(oldTokenId)
    console.log(`Rewards after 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`Rewards after 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);
  })
  
  it("should upgrade Smart LP to new APR 45%", async function () {
    const smartLPNewImpl = await SmartLPNew.deploy();
    
    await helpers.impersonateAccount(smartLPOwner);
    const impersonatedSigner = await ethers.getSigner(smartLPOwner);
    const SmartLPProxyFactory = await ethers.getContractFactory('contracts/contracts_BSC/dApps/NFTTokens/SmartLP.sol:SmartLPProxy');
    const ProxySmartLPProxy = SmartLPProxyFactory.attach(SMART_LP_MAINNET);
    await ProxySmartLPProxy.connect(impersonatedSigner).setTarget(smartLPNewImpl.address);
  

    ProxySmartLP = SmartLPNew.attach(SMART_LP_MAINNET);
    await ProxySmartLP.connect(impersonatedSigner).updateMinPurchaseAmountAndRate("1000000000000000000",20);
    await helpers.stopImpersonatingAccount(smartLPOwner)
    expect(await ProxySmartLP.target()).is.equal(smartLPNewImpl.address);
  });

  it("should purchase Smart LP after upgrade", async function () {
    await ProxySmartLP.buySmartLP({ value: ethers.utils.parseUnits("1.0") });
    newTokenId = await ProxySmartLP.tokenCount();
    console.log(`Purchased NFT ${newTokenId}, token count changed from ${oldTokenId}`)

    expect(newTokenId).to.equal(+oldTokenId + 1)
    expect(await ProxySmartLP.afterLPUpdate(newTokenId)).to.equal(true);
    expect(await ProxySmartLP.afterLPUpdate(oldTokenId)).to.equal(true);
  })

  it("should have valid 20% APR rewards for new NFT after upgrade", async function () {
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
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 20);
    console.log(`Calculated NIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 20);
    console.log(`Calculated GNIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(newTokenId)
    console.log(`New NFT Rewards after 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`New NFT Rewards after 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);
  })

  it("should have valid 45% APR rewards for old NFT after upgrade", async function () {
    let tikSupplies = await ProxySmartLP.tikSupplies(oldTokenId);
    const nbuBnbStakeNonce = tikSupplies.NbuBnbStakeNonce;
    const gnbuBnbStakeNonce = tikSupplies.GnbuBnbStakeNonce;
    const stakeTimestamp = await ProxySmartLP.weightedStakeDate(oldTokenId);

    const NimbBNBLPStakeNonceInfos = await LPStakingBNBNIMB.stakeNonceInfos(SMART_LP_MAINNET, nbuBnbStakeNonce);
    const GnimbBNBLPStakeNonceInfos = await LPStakingBNBGNIMB.stakeNonceInfos(SMART_LP_MAINNET, gnbuBnbStakeNonce);

    const NimbBNBEquivalent = NimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    const GnimbBNBEquivalent = GnimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    
    const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 45);
    console.log(`Calculated NIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 45);
    console.log(`Calculated GNIMB-BNB rewards for 100%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(oldTokenId)
    console.log(`New NFT Rewards after 2 * 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`New NFT Rewards after 2 * 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);

  })
  it("should have valid 10% APR rewards for new NFT after upgrade", async function () {
  
    await helpers.impersonateAccount(smartLPOwner);
    const impersonatedSigner = await ethers.getSigner(smartLPOwner);
    await ProxySmartLP.connect(impersonatedSigner).updateMinPurchaseAmountAndRate("1000000000000000000",10);
    await helpers.stopImpersonatingAccount(smartLPOwner)
    await ProxySmartLP.buySmartLP({ value: ethers.utils.parseUnits("1.0") });
    TokenId10 = await ProxySmartLP.tokenCount();
    let tikSupplies = await ProxySmartLP.tikSupplies(TokenId10);
    const nbuBnbStakeNonce = tikSupplies.NbuBnbStakeNonce;
    const gnbuBnbStakeNonce = tikSupplies.GnbuBnbStakeNonce;
    const stakeTimestamp = await ProxySmartLP.weightedStakeDate(TokenId10);

    const NimbBNBLPStakeNonceInfos = await LPStakingBNBNIMB.stakeNonceInfos(SMART_LP_MAINNET, nbuBnbStakeNonce);
    const GnimbBNBLPStakeNonceInfos = await LPStakingBNBGNIMB.stakeNonceInfos(SMART_LP_MAINNET, gnbuBnbStakeNonce);

    const NimbBNBEquivalent = NimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    const GnimbBNBEquivalent = GnimbBNBLPStakeNonceInfos.rewardsTokenAmount;
    console.log(`Staked ${utils.formatEther(tikSupplies.NbuBnbLpAmount)} NIMB_BNB as equivalent ${utils.formatEther(NimbBNBEquivalent)} NIMB`);
    console.log(`Staked ${utils.formatEther(tikSupplies.GnbuBnbLpAmount)} GNIMB_BNB as equivalent ${utils.formatEther(GnimbBNBEquivalent)} NIMB`);
    
    await helpers.time.increase(YEAR_IN_SEC)

    const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    const calcRewardsNimbBnb = calculateRewards(stakeTimestamp, curTimestamp, NimbBNBEquivalent, 10);
    console.log(`Calculated NIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsNimbBnb)}`)
    const calcRewardsGnimbBnb = calculateRewards(stakeTimestamp, curTimestamp, GnimbBNBEquivalent, 10);
    console.log(`Calculated GNIMB-BNB rewards for 45%APR ${utils.formatEther(calcRewardsGnimbBnb)}`)

    const totalRewardsAfter = await ProxySmartLP.getTokenRewardsAmounts(TokenId10)
    console.log(`New NFT Rewards after 365 days from BNB_NIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbNimbUserRewards)} NIMB`)
    console.log(`New NFT Rewards after 365 days from BNB_GNIMB LP Staking: ${utils.formatEther(totalRewardsAfter.lpBnbGnbuUserRewards)} NIMB`)

    expect(totalRewardsAfter.lpBnbNimbUserRewards).to.equal(calcRewardsNimbBnb);
    expect(totalRewardsAfter.lpBnbGnbuUserRewards).to.equal(calcRewardsGnimbBnb);
  })


});
