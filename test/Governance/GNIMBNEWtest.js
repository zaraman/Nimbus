const {
    BN,
    constants,
    expectEvent,
    expectRevert,
    time,
} = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const { utils } = require("ethers");
const { keccak256, toUtf8Bytes } = utils;

const { expect } = require("chai");
const { ethers, upgrades, waffle, network } = require("hardhat");
// const { both, increaseTime, mineBlock } = require("./Utils");
// const { time } = require("@nomicfoundation/hardhat-network-helpers");

let initialHolder, recipient, anotherAccount

describe("GNIMB", (accounts) => {
    // [owner, other, user2, ...accounts] = await ethers.getSigners();

    const name = "Nimbus Governance Token";
    const symbol = "GNIMB";

    const initialSupply = new BN(10).pow(new BN(26));

    beforeEach(async function () {
        [initialHolder, recipient, anotherAccount] = await ethers.getSigners();
        GNIMB = await ethers.getContractFactory("GNIMB")
        this.token = await GNIMB.deploy();
    });

    describe("core", function () {
        it("has a name", async function () {
            expect(await this.token.name()).to.equal(name);
        });

        it("has a symbol", async function () {
            expect(await this.token.symbol()).to.equal(symbol);
        });

        it("has 18 decimals", async function () {
            const decimals = await this.token.decimals();

            expect(decimals.toString()).to.be.bignumber.equal("18");
        });

        describe("total supply", async function () {
            it("returns the total amount of tokens", async function () {
                const totalSupply = await this.token.totalSupply();

                expect(totalSupply.toString()).to.be.bignumber.equal(initialSupply.toString());
            });
            describe("Pause", async function () {

                it("Test Pause ", async function () {
        
                    await this.token.connect(initialHolder).transfer(anotherAccount.address, "1000000000000000000000")
                    await this.token.connect(initialHolder).pause()
                    await expect( this.token.connect(anotherAccount).transfer(recipient.address,"1000000000000000000000")).to.be.revertedWith('Pausable: paused');
                    await this.token.connect(initialHolder).unpause()
                    await this.token.connect(anotherAccount).transfer(recipient.address, "1000000000000000000000")
                    expect(await this.token.balanceOf(recipient.address)).to.equal("1000000000000000000000");
        
                });

            });
        });
    })
})
