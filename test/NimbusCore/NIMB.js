const {
  BN,
  constants,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");

const { time, mine, mineUpTo } = require("@nomicfoundation/hardhat-network-helpers");

const { ZERO_ADDRESS } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const { utils , BigNumber} = require("ethers");
const { keccak256, toUtf8Bytes } = utils;

const { expect } = require("chai");
const { ethers, upgrades, waffle, network } = require("hardhat");
// const { both, increaseTime, mineBlock } = require("./Utils");
// const { time } = require("@nomicfoundation/hardhat-network-helpers");

let initialHolder, recipient, anotherAccount
let users = []

describe("NIMB", (accounts) => {
  const name = "Nimbus Utility";
  const symbol = "NIMB";

  const initialSupply = ethers.BigNumber.from("10").pow("28");
  const amount = initialSupply;
  describe("vesting, unvesting, multivesting, multisending, delegation", function () {
    //const vester = initialHolder;
    let client;
    const INVESTMENT = '1000000000000000000';
    const DAY = 86400
    const VESTING_FIRST_PERIOD = 5184000 // 60 days
    const VESTING_SECOND_PERIOD = 13132800 // 152 days
    
    beforeEach(async function () {
      [
        initialHolder, 
        recipient, 
        anotherAccount, 
        vester1, 
        vester2, 
        delegator1,
        delegator2,
        delegatee,
        hacker,
        ...users
      ] = await ethers.getSigners();

      NIMB = await ethers.getContractFactory("NIMB")
      this.token = await NIMB.deploy();

      await this.token.connect(initialHolder).updateVesters(initialHolder.address, true);
      await this.token.connect(initialHolder).updateAllowedReceiver(initialHolder.address, true);
      await this.token.connect(initialHolder).mint(initialHolder.address,amount)
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
    });

    describe("balanceOf", function () {
      describe("when the requested account has no tokens", function () {
        it("returns zero", async function () {
          const balance = await this.token.balanceOf(anotherAccount.address);

          expect(balance.toString()).to.be.bignumber.equal("0");
        });
      });

      describe("when the requested account has some tokens", function () {
        it("returns the total amount of tokens", async function () {
          const balance = await this.token.balanceOf(initialHolder.address);

          expect(balance.toString()).to.be.bignumber.equal(initialSupply.toString());
        });
      });
    });

    it("PERMIT_TYPEHASH", async function () {
      expect(await this.token.PERMIT_TYPEHASH()).to.eq(
        keccak256(
          toUtf8Bytes(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
          )
        )
      );
    });
  }); 
  
  describe("transfer", function () {
    describe("when the recipient is not the zero address", function () {
      describe("when the sender does not have enough balance", function () {
        const amount = initialSupply.add(1);

        it("reverts", async function () {
          let transferTx = this.token.transfer(recipient.address, amount.toString(), { from: initialHolder.address });

          await expect(transferTx)
              .to.be.revertedWith("NIMB::_transfer: amount exceeds available for transfer balance")
        });
      });

      describe("when the sender transfers all balance", function () {

        const amount = initialSupply;

        it("transfers the requested amount", async function () {
      
          await this.token.transfer(recipient.address, amount.toString(), { from: initialHolder.address });

          const balance = await this.token.balanceOf(initialHolder.address);
          expect(balance.toString()).to.be.bignumber.equal("0");

          const balanceRecipient = await this.token.balanceOf(recipient.address);
          expect(balanceRecipient.toString()).to.be.bignumber.equal(amount.toString());
        });

        it("emits a transfer event", async function () {
          const amount = initialSupply;
        
          const transferTx = await this.token.transfer(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });

          await expect(transferTx)
              .to.be.emit(this.token, "Transfer")
              .withArgs(initialHolder.address, recipient.address, amount)
        });
      });

      describe("when the sender transfers zero tokens", function () {
        const amount = new BN("0");

        it("transfers the requested amount", async function () {
          await this.token.transfer(recipient.address, amount.toString(), { from: initialHolder.address });

          const balance = await this.token.balanceOf(initialHolder.address);
          expect(balance.toString()).to.be.bignumber.equal(initialSupply.toString());

          const balanceRecipient = await this.token.balanceOf(recipient.address);
          expect(balanceRecipient.toString()).to.be.bignumber.equal("0");
        });

        it("emits a transfer event", async function () {
          const transferTx = await this.token.transfer(recipient.address, amount.toString(), {
            from: initialHolder.address,
          });

          expect(transferTx)
              .to.emit(this.token, "Transfer")
              .withArgs(initialHolder.address, recipient.address. amount)
        });
      });
    });

    describe("when the recipient is the zero address", function () {
      it("reverts", async function () {
        const transferTx = this.token.transfer(ZERO_ADDRESS, initialSupply.toString(), {
          from: initialHolder.address,
        })
        await expect(transferTx).to.be.revertedWith("NIMB::_transfer: transfer to the zero address")
      });
    });
  });

  describe("transfer from", function () {
    let spender;
    let tokenOwner;
    let to;

    beforeEach(function() {
      spender = recipient;
      tokenOwner = initialHolder;
      to = anotherAccount;
    })

    describe("when the token owner is not the zero address", function () {

      describe("when the recipient is not the zero address", function () {

        describe("when the spender has enough approved balance", function () {
          beforeEach(async function () {
            await this.token.approve(spender.address, initialSupply.toString(), {
              from: initialHolder.address,
            });
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("transfers the requested amount", async function () {
              
              await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString());

              const balance = await this.token.balanceOf(tokenOwner.address);
              expect(balance.toString()).to.be.bignumber.equal("0");

              const balanceTo = await this.token.balanceOf(to.address)
              expect(balanceTo.toString()).to.be.bignumber.equal(amount.toString());
            });

            it("decreases the spender allowance", async function () {
              await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString());

              const allowance = await this.token.allowance(tokenOwner.address, spender.address)
              expect(allowance.toString()).to.be.bignumber.equal("0");
            });

            it("emits a transfer event", async function () {
              const transferFromTx = await this.token.connect(spender).transferFrom(
                tokenOwner.address,
                to.address,
                amount.toString(),
              );

              expect(transferFromTx)
                  .to.emit("Transfer")
                  .withArgs(tokenOwner.address, to.address, amount)
            });

            it("emits an approval event", async function () {
              const transferFromTx = await this.token.connect(spender).transferFrom(
                tokenOwner.address,
                to.address,
                amount.toString(),
              );

              const allowance = await this.token.allowance(tokenOwner.address, spender.address);

              expect(transferFromTx)
                  .to.emit("Approval")
                  .withArgs(tokenOwner.address, spender.address, allowance)
            });
          });
        });

        describe("when the spender does not have enough approved balance", function () {
          beforeEach(async function () {
            await this.token.connect(tokenOwner).approve(spender.address, initialSupply.sub(1).toString());
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString());

              await expect(transferFromTx)
                  .to.be.revertedWith("NIMB::transferFrom: transfer amount exceeds allowance")
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString())

              await expect(transferFromTx)
                  .to.be.revertedWith("NIMB::transferFrom: transfer amount exceeds allowance");
            });
          });
        });
      });

      describe("when the recipient is the zero address", function () {
        const amount = initialSupply;
        const to = ZERO_ADDRESS;

        beforeEach(async function () {
          await this.token.approve(spender.address, amount.toString(), { from: tokenOwner.address });
        });

        it("reverts", async function () {
          const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner.address, to, amount.toString());

          await expect(transferFromTx)
              .to.be.revertedWith("NIMB::_transfer: transfer to the zero address")
        });
      });
    });

    describe("when the token owner is the zero address", function () {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;

      it("reverts", async function () {
        const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner, to.address, amount.toString())

        await expect(transferFromTx)
            .to.be.revertedWith("NIMB::_transfer: transfer from the zero address")
      });
    });
  });
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
            .to.be.revertedWith("NIMB::_approve: approve to the zero address")

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
            .to.be.revertedWith("NIMB::vest: not vester")

        });

        describe("vest", function () {

          beforeEach(async function () {
            await this.token.updateVesters(vester1.address, true, {
              from: initialHolder.address,
            });
          });
    
          it("when sender is not vester", async function () {  
            const vestTx = this.token.connect(hacker).vest(hacker.address, INVESTMENT)
            await expect(vestTx)
              .to.be.revertedWith("NIMB::vest: not veste")
          });
    
          it("when sender is vester", async function () {
            const vesting_nonces_before = await this.token.vestingNonces(vester1.address)
            await this.token.connect(vester1).vest(vester1.address, INVESTMENT)
            const vesting_nonces_after = await this.token.vestingNonces(vester1.address)
            expect(vesting_nonces_after > vesting_nonces_before);
          });
        })
    
        describe("unvest without delegation", function () {
          beforeEach(async function () {
            await this.token.connect(initialHolder).vest(recipient.address, INVESTMENT);
          });
    
          it("revert when no vested amount", async function () {
            const unvestTx = this.token.connect(initialHolder).unvest();
            await expect(unvestTx)
              .to.be.revertedWith("NIMB::unvest:No vested amount")
          });
      
    
          it("reject less vestingFirstPeriod", async function () {
            await expect(this.token.connect(recipient).unvest())
              .to.emit(this.token, 'Unvest')
              .withArgs(recipient.address, 0);
          });
    
          it("after vestingFirstPeriod", async function () {
    
            await time.increase(VESTING_FIRST_PERIOD - DAY)
    
            await expect(this.token.connect(recipient).unvest())
              .to.emit(this.token, 'Unvest')
              .withArgs(recipient.address, 0);
    
          });
    
          it("after vestingSecondPeriod", async function () {
            await time.increase(VESTING_SECOND_PERIOD * 2)
    
            await expect(this.token.connect(recipient).unvest())
              .to.emit(this.token, 'Unvest')
              .withArgs(recipient.address, INVESTMENT);
          });
    
          it("vesting is inactive after vestingSecondPeriod", async function () {
            await time.increase(VESTING_SECOND_PERIOD * 100)
        
            await expect(this.token.connect(recipient).unvest())
              .to.emit(this.token, 'Unvest')
              .withArgs(recipient.address, INVESTMENT);
          });
        })
      
  
      describe("multivest", async function () {
        const INVESTMENT = '1000000000000000000';
        const DAY = 86400
        const VESTING_FIRST_PERIOD = 5184000 // 60 days
        const VESTING_SECOND_PERIOD = 13132800 // 152 days
        const vesters = []
        const values = []
    
        beforeEach(async function () {
          await this.token.updateVesters(vester1.address, true, {
            from: initialHolder.address,
          });
    
          await this.token.updateVesters(vester2.address, true, {
            from: initialHolder.address,
          });
        });
    
        it("revert when spender is not owner", async function () {
          const multivestTx = this.token.connect(hacker).multivest([hacker.address], []);
          await expect(multivestTx)
            .to.be.revertedWith("Ownable: Caller is not the owner")
        });
    
        it("revert when multivest to more than 99 accounts", async function () {
          for (let i = 0; i < 100; i++) {
            vesters.push(users[i+10].address)
            values.push(INVESTMENT)
          }
    
          expect(vesters.length >= 100)
    
          const multivestTx = this.token.connect(initialHolder).multivest(vesters, values);
          await expect(multivestTx)
            .to.be.reverted; // more than 99 wallets
        });
    
        it("when accounts length not equal values length", async function () {
          let multivestTx = this.token.connect(initialHolder).multivest(
            [
              vester1.address,
              vester2.address
            ],
            [
              INVESTMENT,
              INVESTMENT,
              INVESTMENT
            ]
          );
    
          await expect(multivestTx)
            .to.be.reverted; // 2 vesters and 3 values
    
          multivestTx = this.token.connect(initialHolder).multivest(
            [
              vester1.address,
              vester2.address
            ],
            [
              INVESTMENT
            ]
          );
      
          await expect(multivestTx)
            .to.be.reverted; // 2 vesters and 1 value
        });
    
        it("vest more than owner balance", async function () {
          let multivestTx = this.token.connect(initialHolder).multivest(
            [
              vester1.address,
              vester2.address
            ],
            [
              initialSupply,
              1000,
            ]
          );
          
          await expect(multivestTx).to.be.reverted
        });
    
        it("multivest for 99 users", async function () {
    
          vesters.pop(); // 100 -> 99
          values.pop(); // 100 -> 99
    
          await this.token.multivest(vesters, values, {
            from: initialHolder.address,
          });
        });
      });
    
      describe("multisend without delegation", async function () {
        const INVESTMENT = '1000000000000000000';
        const DAY = 86400
        const VESTING_FIRST_PERIOD = 5184000 // 60 days
        const VESTING_SECOND_PERIOD = 13132800 // 152 days
        const recipients = []
        const values = []
    
        it("revert when spender is not owner", async function () {
          const multisendTx = this.token.connect(hacker).multisend([hacker.address], [INVESTMENT]);
          await expect(multisendTx)
            .to.be.revertedWith("Ownable: Caller is not the owner")
        });
    
        it("revert when multisend to more than 99 accounts", async function () {
          for (let i = 0; i < 100; i++) {
            recipients.push(users[i+10].address)
            values.push(INVESTMENT)
          }
    
          expect(recipients.length >= 100)
    
          const multisendTx = this.token.connect(initialHolder).multisend(recipients, values);
          await expect(multisendTx)
            .to.be.reverted; // more than 99 wallets
        });
    
        it("when accounts length not equal values length", async function () {
          let multisendTx = this.token.connect(initialHolder).multisend(
            [
              recipients[0].address,
              recipients[1].address
            ],
            [
              INVESTMENT,
              INVESTMENT,
              INVESTMENT
            ]
          );
    
          await expect(multisendTx)
            .to.be.reverted; // 2 recipients and 3 values
    
          multisendTx = this.token.connect(initialHolder).multisend(
            [
              recipients[0].address,
              recipients[1].address
            ],
            [
              INVESTMENT
            ]
          );
      
          await expect(multisendTx)
            .to.be.reverted; // 2 recipients and 1 value
        });
    
        it("multisend more than owner balance", async function () {
          let multisendTx = this.token.connect(initialHolder).multisend(
            [
              recipient.address,
              anotherAccount.address
            ],
            [
              initialSupply,
              1000
            ]
          );
          
          await expect(multisendTx).to.be.reverted
        });
    
        it("multisend to 99 users", async function () {
    
          recipients.pop(); // 100 -> 99
          values.pop(); // 100 -> 99
    
          await this.token.multisend(recipients, values, {
            from: initialHolder.address,
            });
          });

          describe("mint", function () {
            const amount = initialSupply;

            it(" revert mint if try to mint mote than total supply amount ", async function () {
              const amount = initialSupply.add(1);
              await this.token.connect(initialHolder).updateAllowedReceiver(recipient.address, true);
              const mint= this.token.connect(initialHolder).mint(recipient.address, amount.toString());
              await expect(mint).to.be.reverted
        
            });
            it("revert when receiver is not allowed", async function () {
            const mint= this.token.connect(initialHolder).mint(recipient.address, amount.toString());
            await expect(mint)
            .to.be.revertedWith("NIMB::mint: receiver is not allowed")
          });
        });
        describe("updateAllowedReceiver", function () {
          const amount = initialSupply;

          it(" receiver address is equal to 0 ", async function () {
            const updateAllowedReceiver= this.token.connect(initialHolder).updateAllowedReceiver(ZERO_ADDRESS, true);
            await expect(updateAllowedReceiver).to.be.revertedWith("NIMB::updateAllowedReceiver: receiver address is equal to 0")
      
          });
          it("receivers list locked", async function () {
          await this.token.connect(initialHolder).lockReceiversList();
          const updateAllowedReceiver= this.token.connect(initialHolder).updateAllowedReceiver(recipient.address, true);
          await expect(updateAllowedReceiver).to.be.revertedWith("NIMB::updateAllowedReceiver: receivers list locked")
      
              });
            });
          });
        });
      });
    })
  });
});
