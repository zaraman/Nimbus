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

  const initialSupply = new BN(10).pow(new BN(26));

  beforeEach(async function () {
    [initialHolder, recipient, anotherAccount] = await ethers.getSigners();
    GNBU = await ethers.getContractFactory("GNBU")
    this.token = await GNBU.deploy();
  });

  // Mike
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

    it("DOMAIN_TYPEHASH", async function () {
      expect(await this.token.DOMAIN_TYPEHASH()).to.eq(
        keccak256(
          toUtf8Bytes(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
          )
        )
      );
    });

    it("DELEGATION_TYPEHASH", async function () {
      expect(await this.token.DELEGATION_TYPEHASH()).to.eq(
        keccak256(
          toUtf8Bytes(
            "Delegation(address delegatee,uint256 nonce,uint256 expiry)"
          )
        )
      );
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
        const amount = initialSupply.addn(1);

        it("reverts", async function () {
          let transferTx = this.token.transfer(recipient.address, amount.toString(), { from: initialHolder.address });

          await expect(transferTx)
              .to.be.revertedWith("GNBU::_transferTokens: transfer amount exceeds balance")
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
        await expect(transferTx).to.be.revertedWith("GNBU::_transferTokens: cannot transfer to the zero address")
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

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              const transferFromTx = this.token.connect(spender).transferFrom(
                  tokenOwner.address,
                  to.address,
                  amount.toString(),
              )

              await expect(transferFromTx)
                  .to.be.revertedWith("GNBU::transferFrom: transfer amount exceeds spender allowance")
            });
          });
        });

        describe("when the spender does not have enough approved balance", function () {
          beforeEach(async function () {
            await this.token.connect(tokenOwner).approve(spender.address, initialSupply.subn(1).toString());
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString());

              await expect(transferFromTx)
                  .to.be.revertedWith("GNBU::transferFrom: transfer amount exceeds spender allowance")
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount.toString())

              await expect(transferFromTx)
                  .to.be.revertedWith("GNBU::transferFrom: transfer amount exceeds spender allowance");
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
              .to.be.revertedWith("GNBU::_transferTokens: cannot transfer to the zero address")
        });
      });
    });

    describe("when the token owner is the zero address", function () {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;

      it("reverts", async function () {
        const transferFromTx = this.token.connect(spender).transferFrom(tokenOwner, to.address, amount.toString())

        await expect(transferFromTx)
            .to.be.revertedWith("GNBU::_transferTokens: cannot transfer from the zero address")
      });
    });
  });

  // Zakhar
  describe("approve", function () {
    describe("when the spender is not the zero address", function () {
      describe("when the sender has enough balance", function () {
        const amount = initialSupply;

        it("emits an approval event", async function () {
          const { logs } = await this.token.approve(recipient, amount, {
            from: initialHolder,
          });

          expectEvent.inLogs(logs, "Approval", {
            owner: initialHolder,
            spender: recipient,
            amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await this.token.approve(recipient, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, recipient)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await this.token.approve(recipient, new BN(1), {
              from: initialHolder,
            });
          });

          it("approves the requested amount and replaces the previous one", async function () {
            await this.token.approve(recipient, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, recipient)
            ).to.be.bignumber.equal(amount);
          });
        });
      });

      describe("when the sender does not have enough balance", function () {
        const amount = initialSupply.addn(1);

        it("emits an approval event", async function () {
          const { logs } = await this.token.approve(recipient, amount, {
            from: initialHolder,
          });

          expectEvent.inLogs(logs, "Approval", {
            owner: initialHolder,
            spender: recipient,
            amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await this.token.approve(recipient, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, recipient)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await this.token.approve(recipient, new BN(1), {
              from: initialHolder,
            });
          });

          it("approves the requested amount and replaces the previous one", async function () {
            await this.token.approve(recipient, amount, {
              from: initialHolder,
            });

            expect(
              await this.token.allowance(initialHolder, recipient)
            ).to.be.bignumber.equal(amount);
          });
        });
      });
    });

    describe("when the spender is the zero address", function () {
      it("reverts", async function () {
        await expectRevert(
          this.token.approve(ZERO_ADDRESS, initialSupply, {
            from: initialHolder,
          }),
          "GNBU::_approve: approve to the zero address"
        );
      });
    });
  });

  describe("burnTokens", function () {
    describe("for a non zero account", async function () {
      it("rejects burning more than totalSupply", async function () {
        await expectRevert(
          this.token.burnTokens(initialSupply.addn(1), { from: initialHolder }),
          "revert"
        );
      });

      it("rejects burning from not owner", async function () {
        await expectRevert(
          this.token.burnTokens(initialSupply.addn(1), { from: recipient }),
          "Ownable: Caller is not the owner"
        );
      });

      const describeBurn = function (description, amount) {
        describe(description, function () {
          beforeEach("burning", async function () {
            const { logs } = await this.token.burnTokens(amount, {
              from: initialHolder,
            });
            this.logs = logs;
          });

          it("decrements totalSupply", async function () {
            const expectedSupply = initialSupply.sub(amount);
            expect(await this.token.totalSupply()).to.be.bignumber.equal(
              expectedSupply
            );
          });

          it("decrements initialHolder balance", async function () {
            const expectedBalance = initialSupply.sub(amount);
            expect(
              await this.token.balanceOf(initialHolder)
            ).to.be.bignumber.equal(expectedBalance);
          });

          it("emits Transfer event", async function () {
            expectEvent.inLogs(this.logs, "Transfer", {
              from: initialHolder,
              to: ZERO_ADDRESS,
              amount,
            });
          });
        });
      };

      describeBurn("for entire balance", initialSupply);
      describeBurn("for less amount than balance", initialSupply.subn(1));
    });
  });

  describe("vest", function () {
    const vester = recipient;
    const client = anotherAccount;
    beforeEach(async function () {
      await this.token.updateVesters(vester, true, {
        from: initialHolder,
      });
    });

    it("when sender is not vester", async function () {
      await expectRevert(
        this.token.vest(client, initialSupply, { from: client }),
        "GNBU::vest: not vester"
      );
    });

    describe("when sender is vester", function () {
      it("vest more then owner balance", async function () {
        await expectRevert(
          this.token.vest(client, initialSupply.addn(1), {
            from: vester,
          }),
          "GNBU::_vest: exceeds owner balance"
        );
      });

      it("vest all owner balance", async function () {
        const { logs } = await this.token.vest(client, initialSupply, {
          from: vester,
        });

        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: client,
          amount: initialSupply,
        });
      });

      it("vest less then owner balance", async function () {
        const { logs } = await this.token.vest(client, initialSupply.subn(1), {
          from: vester,
        });

        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: client,
          amount: initialSupply.subn(1),
        });
      });
    });
  });

  // Yehor
  describe("unvest", function () {
    const vester = initialHolder;
    const client = recipient;
    const amount = new BN("152");
    beforeEach(async function () {
      await this.token.updateVesters(vester, true, {
        from: initialHolder,
      });
    });

    it("where is no vested amount", async function () {
      await expectRevert(
        this.token.unvest({ from: client }),
        "GNBU::unvest:No vested amount"
      );
    });

    describe("where is vested amount", function () {
      beforeEach(async function () {
        await this.token.vest(client, amount, { from: vester });
      });

      it("reject less vestingFirstPeriod", async function () {
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });
        expect(event.args.amount).to.be.bignumber.equal("0");
      });

      it("after 1 day vestingFirstPeriod", async function () {
        const time = DAY.muln(61).toNumber();
        const t = await timeHelper.increaseTime(time);
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });

        expect(event.args.amount).to.be.bignumber.equal("1");
      });

      it("after vestingSecondPeriod", async function () {
        const time = DAY.muln(152 + 61).toNumber();
        const t = await timeHelper.increaseTime(time);
        const { logs } = await this.token.unvest({ from: client });

        const event = expectEvent.inLogs(logs, "Unvest", {
          user: client,
        });

        expect(event.args.amount).to.be.bignumber.equal(amount);
      });
    });
  });

  describe("multivest", async function () {
    // const [owner, ...users] = accounts;
    [owner, ...users] = await ethers.getSigners();
    const amount = new BN("152");
    it("when spender is not owner", async function () {
      await expectRevert(
        this.token.multivest(users, [], { from: recipient }),
        "Ownable: Caller is not the owner"
      );
    });

    it("when accounts more than 100", async function () {
      const usersMoreThan100 = [];
      const valuesMoreThan100 = [];
      accounts.forEach((e) => {
        usersMoreThan100.push(...accounts);
        usersMoreThan100.push(recipient);
        valuesMoreThan100.push(...accounts);
        valuesMoreThan100.push(recipient);
      });
      await expectRevert(
        this.token.multivest(usersMoreThan100, valuesMoreThan100, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when accounts length not equal values length", async function () {
      const values = users.map((a) => {
        return amount;
      });
      await expectRevert(
        this.token.multivest(accounts, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("vest more than owner balance", async function () {
      await this.token.transfer(recipient, initialSupply.subn(5), {
        from: initialHolder,
      });
      const values = users.map((a) => {
        return amount;
      });
      await expectRevert(
        this.token.multivest(users, values, {
          from: initialHolder,
        }),
        "GNBU::multivest: transfer amount exceeds balance"
      );
    });

    it("multivest for 9 users", async function () {
      const values = users.map((a) => {
        return amount;
      });

      const { logs } = await this.token.multivest(users, values, {
        from: initialHolder,
      });

      users.forEach((u) => {
        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: u,
          amount,
        });
      });
    });
  });

  describe("multisend", async function () {
    [owner, ...users] = await ethers.getSigners();
    const value = new BN("152");
    it("when spender is not owner", async function () {
      await expectRevert(
        this.token.multisend(users, [], { from: recipient }),
        "Ownable: Caller is not the owner"
      );
    });

    it("when accounts more than 100", async function () {
      const usersMoreThan100 = [];
      const valuesMoreThan100 = [];
      accounts.forEach((e) => {
        usersMoreThan100.push(...accounts);
        usersMoreThan100.push(recipient);
        valuesMoreThan100.push(...accounts);
        valuesMoreThan100.push(recipient);
      });
      await expectRevert(
        this.token.multisend(usersMoreThan100, valuesMoreThan100, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when accounts length not equal values length", async function () {
      const values = users.map((a) => {
        return value;
      });
      await expectRevert(
        this.token.multisend(accounts, values, {
          from: initialHolder,
        }),
        "revert"
      );
    });

    it("when transfer more than owner balance", async function () {
      await this.token.transfer(recipient, initialSupply.subn(5), {
        from: initialHolder,
      });
      const values = users.map((a) => {
        return value;
      });
      await expectRevert(
        this.token.multisend(users, values, {
          from: initialHolder,
        }),
        "GNBU::_transferTokens: transfer amount exceeds balance"
      );
    });

    it(" for 9 users", async function () {
      const values = users.map((a) => {
        return value;
      });

      const { logs } = await this.token.multisend(users, values, {
        from: initialHolder,
      });

      users.forEach((u) => {
        expectEvent.inLogs(logs, "Transfer", {
          from: initialHolder,
          to: u,
          amount: value,
        });
      });
    });
  });

  describe("delegate", function () {
    it("to zero address", async function () {
      const event = await this.token.delegate(ZERO_ADDRESS, {
        from: initialHolder,
      });

      expectEvent(event, "DelegateChanged", {
        delegator: initialHolder,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: ZERO_ADDRESS,
      });

      expectEvent.notEmitted(event, "DelegateVotesChanged");
    });

    it("without balance", async function () {
      const event = await this.token.delegate(recipient, {
        from: anotherAccount,
      });

      expectEvent(event, "DelegateChanged", {
        delegator: anotherAccount,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: recipient,
      });

      expectEvent.notEmitted(event, "DelegateVotesChanged");
    });

    it("twice to same user", async function () {
      const event1 = await this.token.delegate(recipient, {
        from: initialHolder,
      });

      expectEvent(event1, "DelegateChanged", {
        delegator: initialHolder,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: recipient,
      });

      expectEvent(event1, "DelegateVotesChanged", {
        delegate: recipient,
        previousBalance: ZERO,
        newBalance: initialSupply,
      });

      const event2 = await this.token.delegate(recipient, {
        from: initialHolder,
      });
      expectEvent(event2, "DelegateChanged", {
        delegator: initialHolder,
        fromDelegate: recipient,
        toDelegate: recipient,
      });

      expectEvent.notEmitted(event2, "DelegateVotesChanged");
    });

    it("succes two delegate with great balance", async function () {
      const firstUser = recipient;
      const secondUser = anotherAccount;
      const delegateAmount = new BN(2000);

      const firstTransfer = await this.token.transfer(
        firstUser,
        delegateAmount
      );

      expectEvent(firstTransfer, "Transfer", {
        from: initialHolder,
        to: firstUser,
        amount: delegateAmount,
      });

      const firstDelegate = await this.token.delegate(secondUser, {
        from: firstUser,
      });

      expectEvent(firstDelegate, "DelegateChanged", {
        delegator: firstUser,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: secondUser,
      });

      expectEvent(firstDelegate, "DelegateVotesChanged", {
        delegate: secondUser,
        previousBalance: ZERO,
        newBalance: delegateAmount,
      });

      const secondTransfer = await this.token.transfer(
        firstUser,
        delegateAmount
      );

      expectEvent(secondTransfer, "Transfer", {
        from: initialHolder,
        to: firstUser,
        amount: delegateAmount,
      });

      expectEvent(secondTransfer, "DelegateVotesChanged", {
        delegate: secondUser,
        previousBalance: delegateAmount,
        newBalance: delegateAmount.muln(2),
      });

      const secondDelegate = await this.token.delegate(initialHolder, {
        from: firstUser,
      });

      expectEvent(secondDelegate, "DelegateChanged", {
        delegator: firstUser,
        fromDelegate: secondUser,
        toDelegate: initialHolder,
      });

      expectEvent(secondDelegate, "DelegateVotesChanged", {
        delegate: secondUser,
        previousBalance: delegateAmount.muln(2),
        newBalance: ZERO,
      });

      expectEvent(secondDelegate, "DelegateVotesChanged", {
        delegate: initialHolder,
        previousBalance: ZERO,
        newBalance: delegateAmount.muln(2),
      });
    });

    it("nested delegation", async function () {
      const user1 = recipient;
      const user2 = anotherAccount;
      const delegateAmount1 = new BN(1000);
      const delegateAmount2 = new BN(2000);

      await this.token.transfer(user1, delegateAmount1);
      await this.token.transfer(user2, delegateAmount2);

      let currectVotes0 = await this.token.getCurrentVotes(user1);
      let currectVotes1 = await this.token.getCurrentVotes(user2);
      expect(currectVotes0).to.be.bignumber.equal(ZERO);
      expect(currectVotes1).to.be.bignumber.equal(ZERO);

      await this.token.delegate(user2, { from: user1 });
      currectVotes1 = await this.token.getCurrentVotes(user2);
      expect(currectVotes1).to.be.bignumber.equal(delegateAmount1);

      await this.token.delegate(user2, { from: user2 });
      currectVotes1 = await this.token.getCurrentVotes(user2);
      expect(currectVotes1).to.be.bignumber.equal(
        delegateAmount1.add(delegateAmount2)
      );

      await this.token.delegate(initialHolder, { from: user2 });
      currectVotes1 = await this.token.getCurrentVotes(user2);
      expect(currectVotes1).to.be.bignumber.equal(delegateAmount1);
    });
  });

  describe("freeCirculation and supportUnits", function () {
    const supportUnits = [initialHolder, recipient];
    const transferAmount = new BN(10000);
    it("freeCirculation", async function () {
      expect(await this.token.freeCirculation()).to.be.bignumber.equal(ZERO);

      await this.token.transfer(recipient, transferAmount);

      expect(await this.token.freeCirculation()).to.be.bignumber.equal(
        transferAmount
      );
    });

    it("support units ", async function () {
      await this.token.transfer(recipient, transferAmount);

      await expectRevert(this.token.updateSupportUnitRemove(0), "revert");
      await this.token.updateSupportUnitAdd(supportUnits[0]);
      await this.token.updateSupportUnitAdd(supportUnits[1]);
      await expectRevert(
        this.token.updateSupportUnitAdd(supportUnits[1]),
        "GNBU::updateSupportUnitAdd: support unit exists"
      );
      await this.token.transfer(supportUnits[1], transferAmount.div(new BN(2)));
      expect(await this.token.freeCirculation()).to.be.bignumber.equal(
        transferAmount
      );
      await this.token.updateSupportUnitRemove(1);
      expect(await this.token.freeCirculation()).to.be.bignumber.equal(
        transferAmount.add(transferAmount.div(new BN(2)))
      );
    });
  });

  describe("getPriorVotes", function () {
    it("reject for not determinate block", async function () {
      const block = await time.latestBlock();
      await expectRevert(
        this.token.getPriorVotes(initialHolder, block.addn(1)),
        "GNBU::getPriorVotes: not yet determined"
      );
    });

    it("without checkpoints", async function () {
      const block = await time.latestBlock();
      expect(
        await this.token.getPriorVotes(initialHolder, block.subn(1))
      ).to.be.bignumber.equal(ZERO);
    });

    it("when block earlier than first checkpoint", async function () {
      const checkpoint = await this.token.delegate(recipient);
      expect(
        await this.token.getPriorVotes(
          recipient,
          new BN(checkpoint.receipt.blockNumber - 1)
        )
      ).to.be.bignumber.equal(ZERO);
    });

    it("success", async function () {
      const checkpoint1 = await this.token.delegate(recipient);
      const checkpoint2 = await this.token.transfer(
        anotherAccount,
        new BN(5000)
      );
      const checkpoint3 = await this.token.delegate(initialHolder);

      expect(
        await this.token.getPriorVotes(
          recipient,
          checkpoint2.receipt.blockNumber
        )
      ).to.be.bignumber.equal(initialSupply.subn(5000));
    });
  });
});
