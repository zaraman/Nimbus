const { signDaiPermit, signERC2612Permit } = require("../../utils/eth-permit");
const { splitSignature } = require('ethers/lib/utils');
const { BigNumberish, constants, Signature, Wallet } = require('ethers');
const { expect } = require("chai");
const { ethers, upgrades, waffle } = require("hardhat");
const { both, increaseTime, mineBlock } = require("./Utils");

describe("Test P2P for NFT Contract", function () {

    beforeEach(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        WBNB = await ethers.getContractFactory("NBU_WBNB")
        WbnbContract = await WBNB.deploy();
        await WbnbContract.deployed()

        BUSD = await ethers.getContractFactory("BUSDTest")
        BusdContract = await BUSD.deploy();
        await BusdContract.deployed()

        NBU = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBUContract = await NBU.deploy();
        await NBUContract.deployed()

        NBU2 = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBU2Contract = await NBU.deploy();
        await NBU2Contract.deployed()

        SmartLp = await ethers.getContractFactory("MockSmartLP")
        SmartLpContract = await upgrades.deployProxy(SmartLp, [WbnbContract.address, BusdContract.address])
        await SmartLpContract.deployed()

        SmartStaker = await ethers.getContractFactory("MockStakingMain")
        SmartStakerContract = await SmartStaker.deploy(WbnbContract.address)
        await SmartStakerContract.deployed()

        const P2P = await ethers.getContractFactory("NimbusP2P_V2");
        p2pContract = await upgrades.deployProxy(P2P, [
            [BusdContract.address, NBUContract.address],
            [true, true],
            [SmartStakerContract.address],
            [true],
            WbnbContract.address,
        ])
        await p2pContract.deployed()

    });

    it("BUSD and NBU should be in allowed list after publish", async function () {
        expect(await p2pContract.allowedEIP20(BusdContract.address)).to.equal(true);
        expect(await p2pContract.allowedEIP20(NBUContract.address)).to.equal(true);
        expect(await p2pContract.allowedEIP20(NBU2Contract.address)).to.equal(false);


    });

    it("Should process trade EIP20 to BNB", async function () {
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const provider = waffle.provider;
        await p2pContract.updateAllowedEIP20Tokens([BusdContract.address, WbnbContract.address], [true, true])
        await BusdContract.approve(p2pContract.address, "100000000000000000000000000000000000");

        await p2pContract.createTradeEIP20ToEIP20(BusdContract.address, "1000000000000000000", WbnbContract.address, "10000000000000000000", curTimestamp + 100)
        const tradeId = 1;
        const balance0ETH = await provider.getBalance(other.address);
        console.log(ethers.utils.formatEther(balance0ETH))
        await p2pContract.connect(other).supportTradeSingleBNB(tradeId, { value: ethers.utils.parseUnits("20.0") })
        expect(await WbnbContract.balanceOf(other.address)).to.equal("0");
        expect(await BusdContract.balanceOf(other.address)).to.equal("1000000000000000000");

        const balance1ETH = await provider.getBalance(other.address);
        console.log(ethers.utils.formatEther(balance0ETH))
        expect(+ethers.utils.formatEther(balance0ETH) - +ethers.utils.formatEther(balance1ETH)).to.be.below(10.1);
    });

    it("Should process trade EIP20 to EIP20", async function () {
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await BusdContract.approve(p2pContract.address, "100000000000000000000000000000000000");

        await p2pContract.createTradeEIP20ToEIP20(BusdContract.address, "1000000000000000000", NBUContract.address, "10000000000000000000", curTimestamp + 100)
        const tradeId = 1;

        await NBUContract.transfer(other.address, "10000000000000000000")
        expect(await NBUContract.balanceOf(other.address)).to.equal("10000000000000000000");
        console.log(await NBUContract.balanceOf(other.address))
        await NBUContract.connect(other).approve(p2pContract.address, "100000000000000000000000000000000000");
        await p2pContract.connect(other).supportTradeSingle(tradeId)
        expect(await NBUContract.balanceOf(other.address)).to.equal("0");
        expect(await BusdContract.balanceOf(other.address)).to.equal("1000000000000000000");

    });

    it("Should process trade BNB to EIP20", async function () {

        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await p2pContract.connect(user2).createTradeBNBtoEIP20(NBUContract.address, "10000000000000000000", curTimestamp + 100, { value: ethers.utils.parseUnits("1.0") });
        const tradeId = 1;

        await NBUContract.transfer(other.address, ethers.utils.parseUnits("10"))
        expect(await NBUContract.balanceOf(other.address)).to.equal(ethers.utils.parseUnits("10"));
        console.log(await NBUContract.balanceOf(other.address))
        await NBUContract.connect(other).approve(p2pContract.address, "100000000000000000000000000000000000");
        expect(await NBUContract.balanceOf(user2.address)).to.equal("0");

        await expect(p2pContract.connect(other).supportTradeSingle(1)).to.emit(p2pContract, "SupportTrade")
            .withArgs("1", other.address);

        expect(await NBUContract.balanceOf(other.address)).to.equal("0");
        expect(await NBUContract.balanceOf(user2.address)).to.equal("10000000000000000000");
        const provider = waffle.provider;
        const balance0ETH = await provider.getBalance(other.address);
        console.log(ethers.utils.formatEther(balance0ETH))
    });
    it("Pause/Rescue for EIP20", async function () {

        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await BusdContract.approve(p2pContract.address, "100000000000000000000000000000000000");
        await p2pContract.createTradeEIP20ToEIP20(BusdContract.address, "1000000000000000000", NBUContract.address, "10000000000000000000", curTimestamp + 100)

        expect(await BusdContract.balanceOf(p2pContract.address)).to.equal("1000000000000000000");
        expect(await p2pContract.paused()).to.equal(false);
        await p2pContract.setPaused(true)
        expect(await p2pContract.paused()).to.equal(true);
        await p2pContract.rescueEIP20(user2.address, BusdContract.address, "1000000000000000000")

        expect(await BusdContract.balanceOf(p2pContract.address)).to.equal("0");
        expect(await BusdContract.balanceOf(user2.address)).to.equal("1000000000000000000");
        await p2pContract.setPaused(false)
        expect(await p2pContract.createTradeEIP20ToEIP20(BusdContract.address, "1000000000000000000", NBUContract.address, "10000000000000000000", curTimestamp + 100)).to.emit(p2pContract, "NewTradeSingle")
            .withArgs(owner.address, BusdContract.address, "1000000000000000000", "0", NBUContract.address, "10000000000000000000", "0", curTimestamp + 100, "1");

    });
    it("Pause/Rescue for rescueEIP721 ", async function () {
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await SmartStakerContract.buySmartStaker("1", "1", { value: ethers.utils.parseUnits("1.0") })
        await SmartStakerContract.approve(p2pContract.address, "1");

        await p2pContract.createTradeNFTtoEIP20(SmartStakerContract.address, "1", NBUContract.address, "10000000000000000000", curTimestamp + 100)
        expect(await SmartStakerContract.balanceOf(p2pContract.address)).to.equal("1");
        expect(await p2pContract.paused()).to.equal(false);
        await p2pContract.setPaused(true)
        expect(await p2pContract.paused()).to.equal(true);
        await SmartStakerContract.buySmartStaker("1", "1", { value: ethers.utils.parseUnits("1.0") })
        await SmartStakerContract.approve(p2pContract.address, "2");
        await expect(p2pContract.createTradeNFTtoEIP20(SmartStakerContract.address, "2", NBUContract.address, "10000000000000000000", curTimestamp + 100)).to.be.revertedWith("paused");

        await p2pContract.rescueEIP721(user2.address, SmartStakerContract.address, "1")
        expect(await SmartStakerContract.balanceOf(p2pContract.address)).to.equal("0");
        expect(await SmartStakerContract.balanceOf(user2.address)).to.equal("1");

    });
    it("Pause/Rescue for WBNB", async function () {
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await p2pContract.connect(user2).createTradeBNBtoEIP20(NBUContract.address, "10000000000000000000", curTimestamp + 100, { value: ethers.utils.parseUnits("1.0") });
        const tradeId = 1;

        await NBUContract.transfer(other.address, ethers.utils.parseUnits("10"))
        expect(await NBUContract.balanceOf(other.address)).to.equal(ethers.utils.parseUnits("10"));
        console.log(await NBUContract.balanceOf(other.address))
        await NBUContract.connect(other).approve(p2pContract.address, "100000000000000000000000000000000000");
        expect(await NBUContract.balanceOf(user2.address)).to.equal("0");

        expect(await WbnbContract.balanceOf(p2pContract.address)).to.equal("1000000000000000000");
        expect(await p2pContract.paused()).to.equal(false);
        await p2pContract.setPaused(true)
        expect(await p2pContract.paused()).to.equal(true);

        await p2pContract.rescueEIP20(user2.address, WbnbContract.address, "1000000000000000000")


    });

    it("createTradeEIP20ToEIP20Permit", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, owner.address, p2pContract.address, "10000000000000000000", curTimestamp + 100);
        console.log(result)
        await p2pContract.connect(owner).createTradeEIP20ToEIP20Permit(NBUContract.address, "10000000000000000000", BusdContract.address, "10000000000000000000", curTimestamp + 100, curTimestamp + 100, result.v, result.r, result.s)


    });

    it("createTradeEIP20ToNFTsPermit", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, owner.address, p2pContract.address, "10000000000000000000", curTimestamp + 100);
        console.log(result)

        await p2pContract.connect(owner).createTradeEIP20ToNFTsPermit(NBUContract.address, "10000000000000000000", [SmartStakerContract.address], ["1"], curTimestamp + 100, curTimestamp + 100, result.v, result.r, result.s);


    });

    it("createTradeEIP20ToNFTsPermit", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, owner.address, p2pContract.address, "10000000000000000000", curTimestamp + 100);
        console.log(result)

        await p2pContract.connect(owner).createTradeEIP20ToNFTsPermit(NBUContract.address, "10000000000000000000", [SmartStakerContract.address], ["1"], curTimestamp + 100, curTimestamp + 100, result.v, result.r, result.s);


    });


    it("supportTradeSingleWithPermit", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, owner.address, p2pContract.address, "10000000000000000000", curTimestamp + 100);
        console.log(result)

        await p2pContract.connect(user2).createTradeBNBtoEIP20(NBUContract.address, "10000000000000000000", curTimestamp + 100, { value: ethers.utils.parseUnits("1.0") });
        const tradeId = 1;

        await p2pContract.connect(owner).supportTradeSingleWithPermit(tradeId, curTimestamp + 100, result.v, result.r, result.s)
    });


    it("updateAllowedNFT", async function () {
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
      
        await BusdContract.connect(owner).approve(SmartLpContract.address, "10000000000000000000");
        await SmartLpContract.connect(owner).buySmartLPforToken("10000000000000000000");
        await SmartLpContract.connect(owner).approve(p2pContract.address, 1);
        await expect( p2pContract.createTradeNFTtoEIP20(SmartLpContract.address, "1", NBUContract.address, "10000000000000000000", curTimestamp + 100)).to.be.revertedWith("NimbusP2P_V2: Not allowed NFT");
        await p2pContract.connect(owner).updateAllowedNFT(SmartLpContract.address, true)
        expect(await p2pContract.allowedNFT(SmartStakerContract.address)).to.equal(true);
        await p2pContract.createTradeNFTtoEIP20(SmartLpContract.address, "1", NBUContract.address, "10000000000000000000", curTimestamp + 100)
    });

    it("updateAllowedEIP20Tokens", async function () {

        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        await NBU2Contract.approve(p2pContract.address, "100000000000000000000000000000000000");
        await expect(p2pContract.createTradeEIP20ToEIP20(NBU2Contract.address, "1000000000000000000", NBUContract.address, "10000000000000000000", curTimestamp + 100)).to.be.revertedWith("NimbusP2P_V2: Not allowed EIP20 Token");
        await p2pContract.connect(owner).updateAllowedEIP20Tokens([NBU2Contract.address], [true])
        expect(await p2pContract.allowedEIP20(NBU2Contract.address)).to.equal(true);
        await p2pContract.createTradeEIP20ToEIP20(NBU2Contract.address, "1000000000000000000", NBUContract.address, "10000000000000000000", curTimestamp + 100)
    });

});
