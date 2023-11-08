const { expect } = require("chai");
const { ethers, network, upgrades } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const NIMB_TARGET = "0xCb492C701F7fe71bC9C4B703b84B0Da933fF26bB"
const BUSD_MAINNET = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
const RECEIVED_CONTRACT1 = "0x13C8C2011643B53925D8e588Aa928d4fEC725EC0"
const RECEIVED_CONTRACT2 = "0x5AB070C173757bba08e9cB9dfa124b79db8D65c8"
const RECEIVED_CONTRACT3 = "0x858Bd837B1C9673B75e9C6350a8194449241bda3"
const RECEIVED_CONTRACT4 = "0x98C5C5B38d28449fF4DF28603673491624CC3684"


let BUSD;

describe("ApVault test", function () {
    before(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        BUSDADDRESS = await ethers.getContractFactory('contracts/mocks/BUSD.sol:BEP20Token');
        BUSD = BUSDADDRESS.attach(BUSD_MAINNET);
        const Contract = await ethers.getContractFactory('contracts/contracts_BSC/Misc/AccessControlProxy.sol:AccessControlProxy');
        let contract = await Contract.deploy(NIMB_TARGET);
        const contractNewPROXY = await contract.deployed()

        APVault = await ethers.getContractFactory('contracts/contracts_BSC/AffiliateProgram-4/APVault.sol:APVault')
        APVaultnew = await upgrades.deployProxy(APVault, [process.env.PURCHASETOKEN, BUSD.address, [RECEIVED_CONTRACT1, RECEIVED_CONTRACT2,
        RECEIVED_CONTRACT3, RECEIVED_CONTRACT4], contractNewPROXY.address, process.env.NIMB_ROUTER, process.env.PANCAKEROUTER])
        APVaultnew = await APVaultnew.deployed()
        console.log('APVault deployed to:', APVaultnew.address)
        await helpers.impersonateAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const impersonatedSigner = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        NIMB = await ethers.getContractFactory('contracts/contracts_BSC/NimbusCore/NIMB.sol:NIMB');
        NIMB = NIMB.attach(NIMB_TARGET);
        await NIMB.connect(impersonatedSigner).updateAllowedReceiver(APVaultnew.address, true);
        await NIMB.connect(impersonatedSigner).transferOwnership(contractNewPROXY.address);
        await contractNewPROXY.acceptOwnerForTarget();
        await contractNewPROXY.updateAllowedMethod(APVaultnew.address, "mint(address,uint256)", true);


    });

    it("processPayment", async function () {
        const balanceBefore1 = await BUSD.balanceOf(RECEIVED_CONTRACT1);
        const balanceBefore2 = await BUSD.balanceOf(RECEIVED_CONTRACT2);
        const balanceBefore3 = await BUSD.balanceOf(RECEIVED_CONTRACT3);
        const balanceBefore4 = await BUSD.balanceOf(RECEIVED_CONTRACT4);
        const askedAmount1 = ethers.BigNumber.from('1000000000000000000');
        const askedAmount2 = ethers.BigNumber.from('2000000000000000000');
        const askedAmount3 = ethers.BigNumber.from('3000000000000000000');
        const askedAmount4 = ethers.BigNumber.from('4000000000000000000');
        await expect(APVaultnew.connect(other).processPayment([askedAmount1, askedAmount2, askedAmount3, askedAmount4])).to.be.revertedWith("Provided address is not allowed");
        await expect(APVaultnew.updateAllowedWallets("0x0000000000000000000000000000000000000000",true)).to.be.revertedWith("Wallet address is equal to 0");
        await APVaultnew.updateAllowedWallets(owner.address,true);
        await APVaultnew.processPayment([askedAmount1, askedAmount2, askedAmount3, askedAmount4]);
        const balanceAfte1 = await BUSD.balanceOf(RECEIVED_CONTRACT1);
        const balanceAfte2 = await BUSD.balanceOf(RECEIVED_CONTRACT2);
        const balanceAfte3 = await BUSD.balanceOf(RECEIVED_CONTRACT3);
        const balanceAfte4 = await BUSD.balanceOf(RECEIVED_CONTRACT4);
        expect((balanceAfte1.sub(balanceBefore1)).toString()).to.equal((askedAmount1).toString());
        expect((balanceAfte2.sub(balanceBefore2)).toString()).to.equal((askedAmount2).toString());
        expect((balanceAfte3.sub(balanceBefore3)).toString()).to.equal((askedAmount3).toString());
        expect((balanceAfte4.sub(balanceBefore4)).toString()).to.equal((askedAmount4).toString());

    });
    it("update max NIMB ", async function () {
        const askedAmount1 = ethers.BigNumber.from('1000000000000000000');
        const askedAmount2 = ethers.BigNumber.from('2000000000000000000');
        const askedAmount3 = ethers.BigNumber.from('3000000000000000000');
        const askedAmount4 = ethers.BigNumber.from('4000000000000000000');
        newMaxNimbAmount = "100"
        await APVaultnew.updateMaxNimbAmount(newMaxNimbAmount);
        expect("100").to.equal(await APVaultnew.maxNimbAmount());
        await APVaultnew.updateAllowedWallets(owner.address,true);
        await expect(APVaultnew.connect(owner).processPayment([askedAmount1, askedAmount2, askedAmount3, askedAmount4])).to.be.revertedWith("NIMB amount more then allowed");

    });

    it("remove receiver wallet ", async function () {
        await APVaultnew.removeReceiverWallet(0);
        expect(await APVaultnew.ReceiveWallets(0)).to.be.equal(RECEIVED_CONTRACT2);

    });
});