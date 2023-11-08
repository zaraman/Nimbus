const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

function calculateRewards(stakeTimestamp, checkTimestamp, equivalent, apr) {
    return new BigNumber.from(equivalent).mul(new BigNumber.from(checkTimestamp).sub(new BigNumber.from(stakeTimestamp))).mul(apr).div(new BigNumber.from(YEAR_IN_SEC).mul(100))
}

const YEAR_IN_SEC = 365 * 24 * 60 * 60;
const MONTH_IN_SEC = 30 * 24 * 60 * 60;
const HALFYEAR_IN_SEC = 180 * 24 * 60 * 60;
const AP_CONTRACT = "0x22777f4A79C2a39c47D71e4558f2245CA3afE1ED"
const HARDSTAKING_365_60_MAINNET = "0x89dcb72D013d7DEF788f8994448327deE9bd3180";
const HARDSTAKING_180_20_MAINNET = "0xd72DbaECd95892694Fd1e62a9C3023D9A692Ef12";
const NIMB_TARGET = "0xCb492C701F7fe71bC9C4B703b84B0Da933fF26bB";
const BUSD_MAINNET = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const investment = "1000000000000000000000";


let BUSD;
let NIMB;
let HARDSTAKING_365;
let HARDSTAKING_180;

describe("StakingRewardsPayment test", function () {
    before(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        BUSDADDRESS = await ethers.getContractFactory('contracts/mocks/BUSD.sol:BEP20Token');
        BUSD = BUSDADDRESS.attach(BUSD_MAINNET);

        HARDSTAKING_365_60_MAINNET_ADDRESS = await ethers.getContractFactory('contracts/contracts_BSC/AffiliateProgram-4/LockStakingRewardFixedAPY.sol:LockStakingRewardFixedAPY');
        HARDSTAKING_365 = HARDSTAKING_365_60_MAINNET_ADDRESS.attach(HARDSTAKING_365_60_MAINNET);

        HARDSTAKING_180_20_MAINNET_ADDRESS = await ethers.getContractFactory('contracts/contracts_BSC/AffiliateProgram-4/LockStakingRewardFixedAPY.sol:LockStakingRewardFixedAPY');
        HARDSTAKING_180 = HARDSTAKING_180_20_MAINNET_ADDRESS.attach(HARDSTAKING_180_20_MAINNET);


        StakingRewardsPayment = await ethers.getContractFactory('contracts/contracts_BSC/Staking/StakingRewardsPayment.sol:StakingRewardsPayment');
        StakingRewardsPaymentnew = await upgrades.deployProxy(StakingRewardsPayment)
        StakingRewardsPaymentnew = await StakingRewardsPaymentnew.deployed()
        console.log('StakingRewardsPayment deployed to:', StakingRewardsPaymentnew.address)
        await helpers.impersonateAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const impersonatedSigner = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        NIMB = await ethers.getContractFactory('contracts/contracts_BSC/NimbusCore/NIMB.sol:NIMB');
        NIMB = NIMB.attach(NIMB_TARGET);
        await NIMB.connect(impersonatedSigner).approve(HARDSTAKING_365_60_MAINNET, "10000000000000000000000");
        await NIMB.connect(impersonatedSigner).approve(HARDSTAKING_180_20_MAINNET, "10000000000000000000000");

        await HARDSTAKING_365.connect(impersonatedSigner).setAffiliateContract(StakingRewardsPaymentnew.address);
        await HARDSTAKING_180.connect(impersonatedSigner).setAffiliateContract(StakingRewardsPaymentnew.address);

    });

    it("should set AP contract", async function () {
        await StakingRewardsPaymentnew.setAffiliateContract(AP_CONTRACT);
        expect(await StakingRewardsPaymentnew.affiliateContract()).to.equal(AP_CONTRACT);
    });

    it("should update allowed stakings", async function () {
        await StakingRewardsPaymentnew.updateAllowedStakings(HARDSTAKING_365_60_MAINNET, true);
        await StakingRewardsPaymentnew.updateAllowedStakings(HARDSTAKING_180_20_MAINNET, true);
        expect(await StakingRewardsPaymentnew.allowedStakings(HARDSTAKING_365_60_MAINNET)).to.equal(true);
        expect(await StakingRewardsPaymentnew.allowedStakings(HARDSTAKING_180_20_MAINNET)).to.equal(true);
    });

    it("should calculate valid rewards in earned", async function () {
        await helpers.impersonateAccount("0xdF1Fd1Ea608F910B1bD6Ca68163f9E817F752af0");
        const impersonatedSigner = await ethers.getSigner("0xdF1Fd1Ea608F910B1bD6Ca68163f9E817F752af0");
        await BUSD.connect(impersonatedSigner).transfer(StakingRewardsPaymentnew.address, "10000000000000000000000");
        await helpers.stopImpersonatingAccount("0xdF1Fd1Ea608F910B1bD6Ca68163f9E817F752af0")
        await helpers.impersonateAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const impersonatedSigner2 = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");

        await NIMB.connect(impersonatedSigner2).approve(HARDSTAKING_365_60_MAINNET, "10000000000000000000000");
        await NIMB.connect(impersonatedSigner2).approve(HARDSTAKING_180_20_MAINNET, "10000000000000000000000");
        await HARDSTAKING_365.connect(impersonatedSigner2).stake(investment);
        await HARDSTAKING_180.connect(impersonatedSigner2).stake(investment);

        await helpers.time.increase(MONTH_IN_SEC)

        const StakeNonceInfos_365 = await HARDSTAKING_365.stakeNonceInfos(impersonatedSigner2.address, "0");
        const stakeTimestamp = StakeNonceInfos_365.stakeTime;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const rewardsTokenAmount = StakeNonceInfos_365.rewardsTokenAmount;
        const rewardRate = StakeNonceInfos_365.rewardRate;

        const StakeNonceInfos_180 = await HARDSTAKING_180.stakeNonceInfos(impersonatedSigner2.address, "0");
        const stakeTimestamp_180 = StakeNonceInfos_180.stakeTime;
        const curTimestamp_180 = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const rewardsTokenAmount_180 = StakeNonceInfos_180.rewardsTokenAmount;
        const rewardRate_180 = StakeNonceInfos_180.rewardRate;

        const calcRewards_365 = calculateRewards(stakeTimestamp, curTimestamp, rewardsTokenAmount, rewardRate);
        const calcRewards_180 = calculateRewards(stakeTimestamp_180, curTimestamp_180, rewardsTokenAmount_180, rewardRate_180);
        console.log(`Calculated rewards ${utils.formatEther(calcRewards_365)}`)
        console.log(`Calculated rewards ${utils.formatEther(calcRewards_180)}`)

        const totalRewardsAfter_365 = await StakingRewardsPaymentnew.earnedByNonce(impersonatedSigner2.address, 0, HARDSTAKING_365.address);
        console.log(`Earned: ${utils.formatEther(totalRewardsAfter_365)} `)
        const totalRewardsAfter_365_earned = await StakingRewardsPaymentnew.earned(impersonatedSigner2.address, HARDSTAKING_365.address);
        expect(totalRewardsAfter_365_earned).to.equal(totalRewardsAfter_365);
        const totalRewardsAfter_180 = await StakingRewardsPaymentnew.earnedByNonceBatch(impersonatedSigner2.address, [0], HARDSTAKING_180.address);
        console.log(`Earned: ${utils.formatEther(totalRewardsAfter_180)} `)
        console.log(`Earned: ${utils.formatEther(totalRewardsAfter_365)} `)

        expect(totalRewardsAfter_365).to.equal(calcRewards_365);
        expect(totalRewardsAfter_180).to.equal(calcRewards_180);

    });

    it("Should withdraw rewards correctly before unlock", async function () {
        const impersonatedSigner2 = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");

        await helpers.time.increase(HALFYEAR_IN_SEC)

        const StakeNonceInfos_180_2 = await HARDSTAKING_180.stakeNonceInfos(impersonatedSigner2.address, "0");
        const stakeTimestamp_180_2 = StakeNonceInfos_180_2.stakeTime;
        const curTimestamp_180_2 = StakeNonceInfos_180_2.unlockTime;
        const rewardsTokenAmount_180_2 = StakeNonceInfos_180_2.rewardsTokenAmount;
        const rewardRate_180_2 = StakeNonceInfos_180_2.rewardRate;
        const calcRewards_180_2 = calculateRewards(stakeTimestamp_180_2, curTimestamp_180_2, rewardsTokenAmount_180_2, rewardRate_180_2);
        console.log(`Calculated rewards ${utils.formatEther(calcRewards_180_2)}`)
        const totalRewardsAfter_180_2 = await StakingRewardsPaymentnew.earned(impersonatedSigner2.address, HARDSTAKING_180.address);
        console.log(`Earned: ${utils.formatEther(totalRewardsAfter_180_2)} `)
        expect(totalRewardsAfter_180_2).to.equal(calcRewards_180_2);
    });

    it("Should withdraw rewards with getAllStakingRewards", async function () {
        await helpers.time.increase(MONTH_IN_SEC);
        await helpers.impersonateAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const userSigner = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const userAddress = await userSigner.getAddress();
        const userBalanceBefore = await BUSD.balanceOf(userAddress);
        await StakingRewardsPaymentnew.connect(userSigner).getAllStakingRewards([4,5]);
        const userBalanceAfter = await BUSD.balanceOf(userAddress);
        expect(userBalanceAfter).to.be.gt(userBalanceBefore);
        
    });

    it("Should withdraw rewards correctly after unlock", async function () {
        const impersonatedSigner2 = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");

        await helpers.time.increase(YEAR_IN_SEC)

        const StakeNonceInfos_365_2 = await HARDSTAKING_365.stakeNonceInfos(impersonatedSigner2.address, "0");
        const stakeTimestamp_365_2 = await StakingRewardsPaymentnew.stakeTime(HARDSTAKING_365.address, impersonatedSigner2.address, "0");
        const curTimestamp_365_2 = StakeNonceInfos_365_2.unlockTime;
        const rewardsTokenAmount_365_2 = StakeNonceInfos_365_2.rewardsTokenAmount;
        const rewardRate_265_2 = StakeNonceInfos_365_2.rewardRate;

        const calcRewards_365_2 = calculateRewards(stakeTimestamp_365_2, curTimestamp_365_2, rewardsTokenAmount_365_2, rewardRate_265_2);

        console.log(`Calculated rewards ${utils.formatEther(calcRewards_365_2)}`)

        const totalRewardsAfter_365_2 = await StakingRewardsPaymentnew.earned(impersonatedSigner2.address, HARDSTAKING_365.address);
        console.log(`Earned: ${utils.formatEther(totalRewardsAfter_365_2)} `)

        await StakingRewardsPaymentnew.connect(impersonatedSigner2).getReward(HARDSTAKING_365.address);
        await StakingRewardsPaymentnew.connect(impersonatedSigner2).getReward(HARDSTAKING_180.address);
        expect(totalRewardsAfter_365_2).to.equal(calcRewards_365_2);
    });

    

    it("Should pause and unpause", async function () {
        const impersonatedSigner2 = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        await StakingRewardsPaymentnew.setPaused(true);
        await expect(StakingRewardsPaymentnew.connect(impersonatedSigner2).getAllStakingRewards([4,5])).to.be.revertedWith("Pausable: paused");
        await expect(StakingRewardsPaymentnew.connect(impersonatedSigner2).getReward(HARDSTAKING_365.address)).to.be.revertedWith("Pausable: paused");
        await StakingRewardsPaymentnew.setPaused(false);
        await StakingRewardsPaymentnew.connect(impersonatedSigner2).getAllStakingRewards([4,5]);
    });

    it("Should rescue specific amount of tokens", async function () {
        const impersonatedSigner2 = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const userAddress = await impersonatedSigner2.getAddress();
        const userBalanceBefore = await BUSD.balanceOf(userAddress);
        await StakingRewardsPaymentnew.rescueERC20(userAddress, BUSD.address, ethers.utils.parseEther("100"));
        const userBalanceAfter = await BUSD.balanceOf(userAddress);
        expect(userBalanceAfter).to.be.gt(userBalanceBefore);
    });
});
