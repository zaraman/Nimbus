const { expect } = require("chai");
const { ethers, network, upgrades } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

function calculateRewards(stakeTimestamp, checkTimestamp, equivalent, apr) {
    return new BigNumber.from(equivalent).mul(new BigNumber.from(checkTimestamp).sub(new BigNumber.from(stakeTimestamp))).mul(apr).div(new BigNumber.from(YEAR_IN_SEC).mul(100))
}

const YEAR_IN_SEC = 365 * 24 * 60 * 60;
const INITIAL_MAINNET = "0x22777f4A79C2a39c47D71e4558f2245CA3afE1ED";
const BUSD_MAINNET = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const NIMB_MAINNET = "0xCb492C701F7fe71bC9C4B703b84B0Da933fF26bB";
const LSRAPY_MAINNET = "0x89dcb72D013d7DEF788f8994448327deE9bd3180";
const NIMBOWNERADDRESS = "0xcc59833469de768fbbfa9aa1d0d5213636f899af";
const NIMBADDRESS2 = "0xd0A111D4349Aad1f8cE82E61d5C8c2BEAc6B2E92";
const NIM_WBNB = "0xA2CA18FC541B7B101c64E64bBc2834B05066248b";
const MAX_PRICE_IMPACT = '20000000000000000';
let BUSD;
let NIMB;
let ACPNIMB;
let ACPNIMBAddress;
let InitialOwner;
describe("NimbusInitialAcquisition v4", function () {
    before(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        // Initial old
        InitialOld = await ethers.getContractFactory('contracts/mocks/NimbusInitialAcquisition.sol:NimbusInitialAcquisition');
        ProxyInitial = InitialOld.attach(INITIAL_MAINNET);
        BUSDADDRESS = await ethers.getContractFactory('contracts/mocks/BUSD.sol:BEP20Token');
        BUSD = BUSDADDRESS.attach(BUSD_MAINNET);
        NIMBADDRESS = await ethers.getContractFactory('contracts/contracts_BSC/NimbusCore/NIMB.sol:NIMB');
        NIMB = NIMBADDRESS.attach(NIMB_MAINNET);
        ACPNIMBAddress = await NIMB.getOwner()
        AccessControlProxy = await ethers.getContractFactory('contracts/contracts_BSC/Misc/AccessControlProxy.sol:AccessControlProxy');
        ACPNIMB = AccessControlProxy.attach(ACPNIMBAddress);
        console.log(`Attached ${INITIAL_MAINNET} as Initial OLD`)
        console.log(`Attached ${BUSD_MAINNET} as BUSD Mainnet`)
        console.log(`Attached ${ACPNIMBAddress} as NIMB Access Control Proxy`)
        InitialOwner = await ProxyInitial.owner();

        await helpers.impersonateAccount("0x2d91a20d699f57d6b85617966b9f11cb1e44abf9");
        const impersonatedSigner = await ethers.getSigner("0x2d91a20d699f57d6b85617966b9f11cb1e44abf9");
        InitialNew = await ethers.getContractFactory('contracts/contracts_BSC/AffiliateProgram-4/NimbusInitialAcquisition.sol:NimbusInitialAcquisition', impersonatedSigner);
        await owner.sendTransaction({
            to: impersonatedSigner.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });

        await owner.sendTransaction({
            to: NIMBOWNERADDRESS,
            value: ethers.utils.parseEther("100"),
        });

    });

    it("should upgrade initial", async function () {
        await upgrades.forceImport(INITIAL_MAINNET, InitialOld);
        const proxied_initial_new = await upgrades.upgradeProxy(
            INITIAL_MAINNET,
            InitialNew,
        )
        ProxyInitial = InitialNew.attach(INITIAL_MAINNET);
    });

    it("should set access and values", async function () {
        await helpers.impersonateAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        const impersonatedSignerNIMB = await ethers.getSigner("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");
        await ACPNIMB.connect(impersonatedSignerNIMB).updateAllowedMethod(INITIAL_MAINNET, "mint(address,uint256)", true);
        await helpers.stopImpersonatingAccount("0xd0a111d4349aad1f8ce82e61d5c8c2beac6b2e92");

        await helpers.impersonateAccount(InitialOwner);
        const impersonatedSignerInitial = await ethers.getSigner(InitialOwner);
        await ProxyInitial.connect(impersonatedSignerInitial).updateSystemToken(
            NIMB_MAINNET,
            ACPNIMBAddress,
            MAX_PRICE_IMPACT
        )
        await helpers.stopImpersonatingAccount(InitialOwner);

    });

    it("should get price impact data", async function () {
        const priceImpact = await ProxyInitial.getMaxSystemTokenImpact();
        console.log(`Price impact 2% NIMB: ${ethers.utils.formatEther(priceImpact.nimb)}`)
        console.log(`Price impact 2% BNB: ${ethers.utils.formatEther(priceImpact.bnb)}`)
        console.log(`Price impact >2% rate: ${ethers.utils.formatEther(priceImpact.rate)}`)

    });

    it("stake for bnb below price impact - no mint", async function () {
        const NIMBIssuedSupplyBefore = await NIMB.issuedSupply();
        console.log("Issued NIMB supply before: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");

        const stakeValue = new BigNumber.from("1000000000000000000");
        console.log("Stake value: " + stakeValue.toString() + " wei (" + ethers.utils.formatEther(stakeValue) + " BNB)")
        const askedAmount = await ProxyInitial.getSwapSystemTokenAmountForBnb(stakeValue);
        console.log("Asked amount: " + askedAmount.toString() + " wei (" + ethers.utils.formatEther(askedAmount) + " NIMB)")
        await helpers.impersonateAccount(NIMBOWNERADDRESS);
        const impersonatedSigner = await ethers.getSigner(NIMBOWNERADDRESS);

        const balanceBefore = await NIMB.balanceOf(LSRAPY_MAINNET);
        await ProxyInitial.connect(impersonatedSigner).buySystemTokenForExactBnb(NIMBOWNERADDRESS, "4", { value: stakeValue });
        await helpers.stopImpersonatingAccount(NIMBOWNERADDRESS);
        const balanceAfter = await NIMB.balanceOf(LSRAPY_MAINNET);
        
        expect((balanceAfter.sub(balanceBefore)).toString()).to.equal((askedAmount).toString());

        const NIMBIssuedSupplyAfter = await NIMB.issuedSupply();
        expect(NIMBIssuedSupplyAfter).to.equal(NIMBIssuedSupplyBefore);
        console.log("Issued NIMB supply after: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");
    });

    it("stake for bnb over price impact - with mint", async function () {
        const priceImpact = await ProxyInitial.getMaxSystemTokenImpact();

        const NIMBIssuedSupplyBefore = await NIMB.issuedSupply();
        console.log("Issued NIMB supply before: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");

        const stakeValue = new BigNumber.from(priceImpact.bnb.add('10000000000000000000'));
        console.log("Stake value: " + stakeValue.toString() + " wei (" + ethers.utils.formatEther(stakeValue) + " BNB)")
        
        const askedAmount = await ProxyInitial.getSwapSystemTokenAmountForBnb(stakeValue);
        console.log("Asked amount: " + askedAmount.toString() + " wei (" + ethers.utils.formatEther(askedAmount) + " NIMB)")

        const askedAmountWithSwap = await ProxyInitial.getSwapRate(await ProxyInitial.NBU_WBNB(), await ProxyInitial.SYSTEM_TOKEN(), stakeValue, true);
        const toMint = askedAmount.sub(askedAmountWithSwap);
        console.log("Asked amount on price impact: " + askedAmountWithSwap.toString() + " wei (" + ethers.utils.formatEther(askedAmountWithSwap) + " NIMB)")
        console.log("To mint: " + toMint.toString() + " wei (" + ethers.utils.formatEther(toMint) + " NIMB)");

        await helpers.impersonateAccount(NIMBOWNERADDRESS);
        const impersonatedSigner = await ethers.getSigner(NIMBOWNERADDRESS);

        const balanceBefore = await NIMB.balanceOf(LSRAPY_MAINNET);
        await ProxyInitial.connect(impersonatedSigner).buySystemTokenForExactBnb(NIMBOWNERADDRESS, "4", { value: stakeValue });
        await helpers.stopImpersonatingAccount(NIMBOWNERADDRESS);
        const balanceAfter = await NIMB.balanceOf(LSRAPY_MAINNET);
        
        expect((balanceAfter.sub(balanceBefore)).toString()).to.equal((askedAmount).toString());

        const NIMBIssuedSupplyAfter = await NIMB.issuedSupply();
        const mintedSupply = NIMBIssuedSupplyAfter.sub(NIMBIssuedSupplyBefore);
        console.log("Minted NIMB supply: " + mintedSupply.toString() + " wei (" + ethers.utils.formatEther(mintedSupply) + " NIMB)");
        console.log("Issued NIMB supply after: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");
        
        expect(mintedSupply).to.equal(toMint);
    });

    it("stake for BUSD", async function () {
        const BUSDOWNERADDRESS = "0x5a52e96bacdabb82fd05763e25335261b270efcb";
        await helpers.impersonateAccount(BUSDOWNERADDRESS);
        const impersonatedSigner = await ethers.getSigner(BUSDOWNERADDRESS);
        await owner.sendTransaction({
            to: BUSDOWNERADDRESS,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });
        const askedAmount = await ProxyInitial.getSwapSystemTokenAmountForToken(BUSD_MAINNET, "1000000000000000000000");

        const balanceBefore = await NIMB.balanceOf(LSRAPY_MAINNET);
        await BUSD.connect(impersonatedSigner).approve(INITIAL_MAINNET, "10000000000000000000000000000000000");
        await ProxyInitial.connect(impersonatedSigner).buySystemTokenForExactTokensAndRegister(BUSD_MAINNET, "1000000000000000000000", BUSDOWNERADDRESS, "4", "1000000001");
        await helpers.stopImpersonatingAccount(BUSDOWNERADDRESS);
        const balanceAfter = await NIMB.balanceOf(LSRAPY_MAINNET);
        expect((balanceAfter.sub(balanceBefore)).toString()).to.equal((askedAmount).toString());
    });
    it("buySystemTokenForExactBnbAndRegister and check requires", async function () {
        const NIMBIssuedSupplyBefore = await NIMB.issuedSupply();
        console.log("Issued NIMB supply before: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");

        const stakeValue = new BigNumber.from("100000000000000000");
        console.log("Stake value: " + stakeValue.toString() + " wei (" + ethers.utils.formatEther(stakeValue) + " BNB)")
        const askedAmount = await ProxyInitial.getSwapSystemTokenAmountForBnb(stakeValue);
        console.log("Asked amount: " + askedAmount.toString() + " wei (" + ethers.utils.formatEther(askedAmount) + " NIMB)")
        await helpers.impersonateAccount(InitialOwner);
        const impersonatedSignerInitial = await ethers.getSigner(InitialOwner);
        await ProxyInitial.connect(impersonatedSignerInitial).updateAllowedTokens(NIM_WBNB,false);
        await helpers.stopImpersonatingAccount(InitialOwner);
        await helpers.impersonateAccount(NIMBADDRESS2);
        const impersonatedSigner = await ethers.getSigner(NIMBADDRESS2);
        const balanceBefore = await NIMB.balanceOf(LSRAPY_MAINNET);
        await expect (ProxyInitial.connect(impersonatedSigner).buySystemTokenForExactBnbAndRegister(NIMBADDRESS2, "4","1000000001", { value: stakeValue })).to.be.revertedWith("Not allowed purchase for BNB");
        await helpers.stopImpersonatingAccount(NIMBADDRESS2);
        await helpers.impersonateAccount(InitialOwner);
        const impersonatedSignerInitial2 = await ethers.getSigner(InitialOwner);
        await ProxyInitial.connect(impersonatedSignerInitial2).updateAllowedTokens(NIM_WBNB,true);
        await helpers.stopImpersonatingAccount(InitialOwner);
        await helpers.impersonateAccount(NIMBADDRESS2);
        const impersonatedSigner2 = await ethers.getSigner(NIMBADDRESS2);
        await expect (ProxyInitial.connect(impersonatedSigner2).buySystemTokenForExactBnbAndRegister(NIMBADDRESS2, "10","1000000001", { value: stakeValue })).to.be.revertedWith("No staking pool with provided id");
        await ProxyInitial.connect(impersonatedSigner).buySystemTokenForExactBnbAndRegister(NIMBADDRESS2, "4","1000000001", { value: stakeValue });
        await helpers.stopImpersonatingAccount(NIMBADDRESS2);
        const balanceAfter = await NIMB.balanceOf(LSRAPY_MAINNET);
        
        expect((balanceAfter.sub(balanceBefore)).toString()).to.equal((askedAmount).toString());

        const NIMBIssuedSupplyAfter = await NIMB.issuedSupply();
        expect(NIMBIssuedSupplyAfter).to.equal(NIMBIssuedSupplyBefore);
        console.log("Issued NIMB supply after: " + NIMBIssuedSupplyBefore.toString() + " wei (" + ethers.utils.formatEther(NIMBIssuedSupplyBefore) + " NIMB)");
    });

});
    