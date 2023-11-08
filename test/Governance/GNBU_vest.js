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

describe("GNBU", (accounts) => {
  // [owner, other, user2, ...accounts] = await ethers.getSigners();

  const name = "Nimbus Governance Token";
  const symbol = "GNBU";

  const initialSupply = ethers.BigNumber.from("10").pow("26");

  beforeEach(async function () {
    [initialHolder, recipient, anotherAccount] = await ethers.getSigners();
    GNBU = await ethers.getContractFactory("GNBU")
    this.token = await GNBU.deploy();
  });

  // Zakhar
  describe("approve", function () {
    describe("when the spender is not the zero address", function () {
      describe("when the sender has enough balance", function () {
        const amount = ethers.BigNumber.from('1');

        it("emits an approval event", async function () {
          const Approve = await this.token.approve(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });

          await expect(this.token.connect(initialHolder).approve(recipient.address, amount.toString())).to.emit(this.token, "Approval")
            .withArgs(initialHolder.address, recipient.address, amount);
        });

        describe("when there was no approved amount before", function () {

          it("approves the requested amount", async function () {
            const ApproveTX = this.token.approve(recipient.address, amount.toString(), {
              from: initialHolder.address,
            });

            expect(await this.token.allowance(initialHolder.address, recipient.address)
            ).to.be.equal(amount.toString());

          });
        });

        describe("when the spender had an approved amount", function () {

          beforeEach(async function () {
            const ApproveTX = this.token.approve(recipient.address, amount.toString(), {
              from: initialHolder.address,
            });
          });

          it("approves the requested amount and replaces the previous one", async function () {
            await this.token.approve(recipient.address, amount.toString(), {
              from: initialHolder.address,
            });

            expect(
              await this.token.allowance(initialHolder.address, recipient.address)
            ).to.be.equal(amount.toString());
          });
        });
      });

      describe("when the sender does not have enough balance", function () {

        const amount = initialSupply.add("1");
        it("emits an approval event", async function () {
          const ApproveTX = await this.token.approve(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });

          await expect(this.token.connect(initialHolder).approve(recipient.address, amount.toString())).to.emit(this.token, "Approval")
            .withArgs(initialHolder.address, recipient.address, amount);
        });


      });

      describe("when there was no approved amount before", function () {
        const amount = ethers.BigNumber.from('1');
        it("approves the requested amount", async function () {
          const ApproveTX = this.token.approve(recipient.address, amount, {
            from: initialHolder.address,
          });

          expect(
            await this.token.allowance(initialHolder.address, recipient.address)
          ).to.be.equal(amount);
        });
      });

      describe("when the spender had an approved amount", function () {
        const amount = initialSupply.add("1");
        beforeEach(async function () {


          const ApproveTX = this.token.approve(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });
        });

        it("approves the requested amount and replaces the previous one", async function () {

          await this.token.approve(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });

          expect(
            await this.token.allowance(initialHolder.address, recipient.address)
          ).to.be.equal(amount.toString());
        });
      });


      describe("when the spender is the zero address", function () {
        it("reverts", async function () {

          const ApproveTx = this.token.approve(ZERO_ADDRESS, initialSupply, {
            from: initialHolder.address,
          })

          await expect(ApproveTx)
            .to.be.revertedWith("GNBU::approve: approve to the zero address")

        });
      });
    });

    describe("burnTokens", function () {
      describe("for a non zero account", async function () {
        it("rejects burning more than totalSupply", async function () {
          const BurnTokens = this.token.burnTokens(initialSupply.add("1"), { from: initialHolder.address })

          await expect(BurnTokens)
            .to.be.revertedWith("revert")

        });

        it("rejects burning from not owner", async function () {
          const burnTokensTx = this.token.connect(recipient).burnTokens(initialSupply.add("1"));

          await expect(burnTokensTx).to.be.revertedWith("Ownable: Caller is not the owner");
        });

        const describeBurn = function (description, amount) {
          describe(description, function () {
            beforeEach("burning", async function () {
              this.burnTx = await this.token.connect(initialHolder).burnTokens(amount);
            });

            it("decrements totalSupply", async function () {
              const expectedSupply = initialSupply.sub(amount);
              const totalSupply = await this.token.totalSupply()

              expect(totalSupply.toString()).to.equal(expectedSupply.toString());
            });

            it("decrements initialHolder.address balance", async function () {
              const expectedBalance = initialSupply.sub(amount);
              const holderBalance = await this.token.balanceOf(initialHolder.address);

              expect(holderBalance.toString()).to.be.equal(expectedBalance.toString());
            });

            it("emits Transfer event", async function () {
              expect(this.burnTx)
                  .to.emit("Transfer")
                  .withArgs(initialHolder.address, ZERO_ADDRESS, amount);
            });
          });
        };

        describeBurn("for entire balance", initialSupply);
        describeBurn("for less amount than balance", initialSupply.subn(1));
      // });
    });

      describe("vest", function () {

        beforeEach(async function () {
          await this.token.updateVesters(recipient.address, true, {
            from: initialHolder.address,
          });
        });

        it("when sender is not vester", async function () {
          
          const VestTX = this.token.connect(anotherAccount).vest(anotherAccount.address, initialSupply)
          await expect(VestTX)
            .to.be.revertedWith("GNBU::vest: not vester")

        });

          // describe("when sender is vester", function () {
          //   it("vest more then owner balance", async function () {
          //     await expectRevert(
          //       this.token.vest(client, initialSupply.addn(1), {
          //         from: vester,
          //       }),
          //       "GNBU::_vest: exceeds owner balance"
          //     );
          //   });

        //     it("vest all owner balance", async function () {
        //       const { logs } = await this.token.vest(client, initialSupply, {
        //         from: vester,
        //       });

        //       expectEvent.inLogs(logs, "Transfer", {
        //         from: initialHolder.address,
        //         to: client,
        //         amount: initialSupply,
        //       });
        //     });

        //     it("vest less then owner balance", async function () {
        //       const { logs } = await this.token.vest(client, initialSupply.subn(1), {
        //         from: vester,
        //       });

        //       expectEvent.inLogs(logs, "Transfer", {
        //         from: initialHolder.address,
        //         to: client,
        //         amount: initialSupply.subn(1),
      });
    });
  });
});


