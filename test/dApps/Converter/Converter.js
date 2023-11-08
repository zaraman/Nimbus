const { signDaiPermit, signERC2612Permit } = require("../../utils/eth-permit");
const { splitSignature } = require('ethers/lib/utils');
const { BigNumberish, constants, Signature, Wallet } = require('ethers');
const { expect } = require("chai");
const { ethers, upgrades, waffle } = require("hardhat");

describe("Converter PriceFeed test", function () {

    beforeEach(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        NBU = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBUContract = await NBU.deploy();
        await NBUContract.deployed()

        NBU2 = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBU2Contract = await NBU.deploy();
        await NBU2Contract.deployed()

        Converter = await ethers.getContractFactory("ConverterNBU")
        ConverterContract = await Converter.deploy(NBUContract.address, NBU2Contract.address);
        await ConverterContract.deployed()
        PriceFeeds = await ethers.getContractFactory("contracts/contracts_BSC/dApps/RevenueChannels/feeds/PriceFeeds.sol:PriceFeeds")
        PriceFeedscontract = await PriceFeeds.deploy();
        await PriceFeedscontract.deployed()

        NimbusPriceFeed1 = await ethers.getContractFactory("NimbusPriceFeed")
        NimbusPriceFeed1Contract = await NimbusPriceFeed1.deploy();
        await NimbusPriceFeed1Contract.deployed()

        NimbusPriceFeed2 = await ethers.getContractFactory("NimbusPriceFeed")
        NimbusPriceFeed2Contract = await NimbusPriceFeed2.deploy();
        await NimbusPriceFeed2Contract.deployed()
    });

    it("Test PriceFeed using + convertWithPermit+cancelOrder", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, other.address, ConverterContract.address, "1000000000000000000000", curTimestamp + 100);
        console.log(result)
        await NimbusPriceFeed1Contract.connect(owner).setLatestAnswer("1000000000000000000")
        await NimbusPriceFeed2Contract.connect(owner).setLatestAnswer("1000000000000000000")
        await PriceFeedscontract.connect(owner).setDecimals([NBUContract.address, NBU2Contract.address])
        await PriceFeedscontract.connect(owner).setPriceFeed([NBUContract.address, NBU2Contract.address], [NimbusPriceFeed1Contract.address, NimbusPriceFeed2Contract.address])
        await ConverterContract.connect(owner).updatePriceFeed(PriceFeedscontract.address)
        await ConverterContract.connect(owner).updateUsePriceFeeds(true)
        expect(await ConverterContract.usePriceFeeds()).to.equal(true);
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await ConverterContract.connect(other).convertWithPermit("1000000000000000000000", curTimestamp + 100, result.v, result.r, result.s)
        await ConverterContract.connect(owner).cancelConversions([0])
        expect(await NBU2Contract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("0");


    });
    it("convertWithPermit + distribute", async function () {
        const provider = waffle.provider;
        const curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        const result = await signERC2612Permit(provider, NBUContract.address, other.address, ConverterContract.address, "1000000000000000000000", curTimestamp + 100);
        console.log(result)
        await NimbusPriceFeed1Contract.connect(owner).setLatestAnswer("1000000000000000000")
        await NimbusPriceFeed2Contract.connect(owner).setLatestAnswer("1000000000000000000")
        await PriceFeedscontract.connect(owner).setDecimals([NBUContract.address, NBU2Contract.address])
        await PriceFeedscontract.connect(owner).setPriceFeed([NBUContract.address, NBU2Contract.address], [NimbusPriceFeed1Contract.address, NimbusPriceFeed2Contract.address])
        await ConverterContract.connect(owner).updatePriceFeed(PriceFeedscontract.address)
        await ConverterContract.connect(owner).updateUsePriceFeeds(true)
        expect(await ConverterContract.usePriceFeeds()).to.equal(true);
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await ConverterContract.connect(other).convertWithPermit("1000000000000000000000", curTimestamp + 100, result.v, result.r, result.s)
        await ConverterContract.connect(owner).distributeConversions([0])
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("1000000000000000000000");
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBU2Contract.balanceOf(ConverterContract.address)).to.equal("0");
    });

    it("Test convert with distribute", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "1000000000000000000000")
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).distributeConversions([0])
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("1000000000000000000000");
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBU2Contract.balanceOf(ConverterContract.address)).to.equal("0");
        expect(await NBUContract.balanceOf(other.address)).to.equal("0");

    });
    it("Test convert with cancel", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "1000000000000000000000")
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).cancelConversions([0])
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("0");
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBU2Contract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBUContract.balanceOf(other.address)).to.equal("0");
    });

    it("Test Pause", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "1000000000000000000000")
        await ConverterContract.connect(owner).setPaused(true)
        await expect(ConverterContract.connect(other).convert("1000000000000000000000")).to.be.revertedWith('Pausable: paused');
        await ConverterContract.connect(owner).setPaused(false)
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).distributeConversions([0])
        expect(await ConverterContract.paused()).to.equal(false);

    });
    it("Test convert with updateLimitedAmounts", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "2000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "2000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "2000000000000000000000")
        await ConverterContract.connect(owner).updateLimitedAmounts([other.address], ["1000000000000000000000"])
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await expect(ConverterContract.connect(owner).distributeConversions([0])).to.be.revertedWith('Request should not be empty');
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).distributeConversions([1])
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("2000000000000000000000");
        expect(await NBUContract.balanceOf(other.address)).to.equal("0");
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("1000000000000000000000");

    });

    it("Test PriceFeeds using", async function () {
        await NimbusPriceFeed1Contract.connect(owner).setLatestAnswer("1000000000000000000")
        await NimbusPriceFeed2Contract.connect(owner).setLatestAnswer("4000000000000000000")
        await PriceFeedscontract.connect(owner).setDecimals([NBUContract.address, NBU2Contract.address])
        await PriceFeedscontract.connect(owner).setPriceFeed([NBUContract.address, NBU2Contract.address], [NimbusPriceFeed1Contract.address, NimbusPriceFeed2Contract.address])
        await ConverterContract.connect(owner).updatePriceFeed(PriceFeedscontract.address)
        await ConverterContract.connect(owner).updateUsePriceFeeds(true)
        expect(await ConverterContract.usePriceFeeds()).to.equal(true);
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "1000000000000000000")
        await ConverterContract.connect(other).convert("1000000000000000000")
        const LatestAnswer1 = await NimbusPriceFeed1Contract.latestAnswer();
        const LatestAnswer2 = await NimbusPriceFeed2Contract.latestAnswer();
        const getEquivalentAmount = await ConverterContract.getEquivalentAmount("1000000000000000000")
        const Div = LatestAnswer2.div(LatestAnswer1);
        const DIv2 = (LatestAnswer1).mul("1000000000000000000").div(LatestAnswer2)
        expect(DIv2.toString()).to.equals(getEquivalentAmount.toString());
        console.log((123), LatestAnswer2.toString(), LatestAnswer1.toString(), LatestAnswer2.div(LatestAnswer1).toString(), getEquivalentAmount.toString(), Div.toString(), DIv2.toString())
    });

    it("Test rescue tokens", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "1000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "1000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "1000000000000000000000")
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).distributeConversions([0])
        await ConverterContract.connect(owner).rescueERC20(other.address, NBUContract.address, "1000000000000000000000")
        expect(await NBUContract.balanceOf(other.address)).to.equal("1000000000000000000000");
    });

    it("test updateAllowedVerifier", async function () {
        await ConverterContract.connect(owner).updateAllowedVerifier(other.address, true)
        expect(await ConverterContract.allowedVerifiers(other.address)).to.equal(true);
    });

    it("Test updateVerifyRequired", async function () {
        await NBU2Contract.connect(owner).transfer(ConverterContract.address, "3000000000000000000000")
        await NBUContract.connect(owner).transfer(other.address, "3000000000000000000000")
        await NBUContract.connect(other).approve(ConverterContract.address, "3000000000000000000000")
        await ConverterContract.connect(owner).updateVerifyRequired(false)
        expect(await ConverterContract.isVerifyRequired()).to.equal(false);

        await ConverterContract.connect(other).convert("1000000000000000000000")
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("1000000000000000000000");
        expect(await NBUContract.balanceOf(other.address)).to.equal("2000000000000000000000");
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("1000000000000000000000");
        
        await ConverterContract.connect(owner).updateVerifyRequired(true)
        expect(await ConverterContract.isVerifyRequired()).to.equal(true);
        await ConverterContract.connect(other).convert("1000000000000000000000")
        await ConverterContract.connect(owner).distributeConversions([0])
        expect(await NBUContract.balanceOf(ConverterContract.address)).to.equal("2000000000000000000000");
        expect(await NBUContract.balanceOf(other.address)).to.equal("1000000000000000000000");
        expect(await NBU2Contract.balanceOf(other.address)).to.equal("2000000000000000000000");


    });


});
