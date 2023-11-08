const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

function calculateRewards(stakeTimestamp, checkTimestamp, equivalent, apr) {
    return new BigNumber.from(equivalent).mul(new BigNumber.from(checkTimestamp).sub(new BigNumber.from(stakeTimestamp))).mul(apr).div(new BigNumber.from(YEAR_IN_SEC).mul(100))
}

const MONTH_IN_SEC = 30 * 24 * 60 * 60;
const SMART_LP_MAINNET = "0x4032E41eAbe002f5e4b28d3B47A8E23660b09e6D";

let smartLPOwner;
let ProxySmartLP;

let SmartLPOld;
let SmartLPNew;
let LPStakingBNBNIMB;
let LPStakingBNBGNIMB;

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

    it("should burn after upgrade", async function () {
        const tokenCountBefore = await ProxySmartLP.tokenCount();
        await ProxySmartLP.buySmartLP({ value: ethers.utils.parseUnits("1.0") });
        oldTokenId = await ProxySmartLP.tokenCount();
        console.log(`Purchased NFT ${oldTokenId}, token count changed from ${tokenCountBefore}`)

        expect(oldTokenId).to.equal(+tokenCountBefore + 1)
        const smartLPNewImpl = await SmartLPNew.deploy();
        await helpers.impersonateAccount(smartLPOwner);
        const impersonatedSigner = await ethers.getSigner(smartLPOwner);
        const SmartLPProxyFactory = await ethers.getContractFactory('contracts/contracts_BSC/dApps/NFTTokens/SmartLP.sol:SmartLPProxy');
        const ProxySmartLPProxy = SmartLPProxyFactory.attach(SMART_LP_MAINNET);
        await ProxySmartLPProxy.connect(impersonatedSigner).setTarget(smartLPNewImpl.address);
        await helpers.stopImpersonatingAccount(smartLPOwner)

        ProxySmartLP = SmartLPNew.attach(SMART_LP_MAINNET);
        expect(await ProxySmartLP.target()).is.equal(smartLPNewImpl.address);
        await expect(ProxySmartLP.burnSmartLP(oldTokenId)).to.be.revertedWith('Token is locked');
        await ProxySmartLP.buySmartLP({ value: ethers.utils.parseUnits("1.0") });
        await ProxySmartLP.burnSmartLP(+tokenCountBefore + 2);
        await helpers.time.increase(MONTH_IN_SEC)
        await ProxySmartLP.burnSmartLP(+tokenCountBefore + 1);

    });


});
