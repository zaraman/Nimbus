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

describe("GNBU", (accounts) => {
  const name = "Nimbus Governance Token";
  const symbol = "GNBU";

  const initialSupply = ethers.BigNumber.from("10").pow("26");

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

      GNIMB = await ethers.getContractFactory("GNIMB")
      this.token = await GNIMB.deploy();

      await this.token.connect(initialHolder).updateVesters(initialHolder.address, true);
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
          .to.be.revertedWith("GNBU::vest: not vester")
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
          .to.be.revertedWith("GNBU::unvest:No vested amount")
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
  
    describe("unvest with delegation", function () {
      beforeEach(async function () {
       // await this.token.connect(initialHolder).transfer(delegator1.address, INVESTMENT)

        await expect(this.token.connect(delegator1).delegate(delegatee.address))
          .to.emit(this.token, 'DelegateChanged')
          .withArgs(delegator1.address, ZERO_ADDRESS, delegatee.address);

        await this.token.connect(initialHolder).vest(delegator1.address, INVESTMENT);
      });

      it("revert when no vested amount", async function () {
        const unvestTx = this.token.connect(initialHolder).unvest();
        await expect(unvestTx)
          .to.be.revertedWith("GNBU::unvest:No vested amount")
      });
  

      it("reject less vestingFirstPeriod", async function () {
        await expect(this.token.connect(delegator1).unvest())
          .to.emit(this.token, 'Unvest')
          .withArgs(delegator1.address, 0);
      });

      it("after vestingFirstPeriod", async function () {

        await time.increase(VESTING_FIRST_PERIOD - DAY)

        await expect(this.token.connect(delegator1).unvest())
          .to.emit(this.token, 'Unvest')
          .withArgs(delegator1.address, 0);

      });

      it("should unvest the whole investment (votes check)", async function () {
        await time.increase(VESTING_SECOND_PERIOD * 2)
        const votes_before_unvest = (await this.token.getCurrentVotes(delegatee.address)).toString()

        await expect(this.token.connect(delegator1).unvest())
          .to.emit(this.token, 'Unvest')
          .withArgs(delegator1.address, INVESTMENT);

        await time.increase(VESTING_SECOND_PERIOD)

        const DELEGATOR_BALANCE = await this.token.availableForTransfer(delegator1.address)

        expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
          BigNumber.from(DELEGATOR_BALANCE)
        );

      });

      it("vesting is inactive after vestingSecondPeriod", async function () {
        await time.increase(VESTING_SECOND_PERIOD * 100)
    
        await expect(this.token.connect(delegator1).unvest())
          .to.emit(this.token, 'Unvest')
          .withArgs(delegator1.address, INVESTMENT);
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
      
      await expect(multivestTx).to.be.revertedWith(
        "GNBU::multivest: transfer amount exceeds balance"
      )
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
      
      await expect(multisendTx).to.be.revertedWith(
        "GNBU::_transferTokens: transfer amount exceeds balance"
      )
    });

    it("multisend to 99 users", async function () {

      recipients.pop(); // 100 -> 99
      values.pop(); // 100 -> 99

      await this.token.multisend(recipients, values, {
        from: initialHolder.address,
      });
    });
  });

  describe("multisend with delegation", async function () {
    const INVESTMENT = '1000000000000000000';
    const DAY = 86400
    const VESTING_FIRST_PERIOD = 5184000 // 60 days
    const VESTING_SECOND_PERIOD = 13132800 // 152 days
    const recipients = []
    const values = []

    beforeEach(async function () {
      await expect(this.token.connect(delegator1).delegate(delegatee.address))
         .to.emit(this.token, 'DelegateChanged')
         .withArgs(delegator1.address, ZERO_ADDRESS, delegatee.address);

      await expect(this.token.connect(delegator2).delegate(delegatee.address))
         .to.emit(this.token, 'DelegateChanged')
         .withArgs(delegator2.address, ZERO_ADDRESS, delegatee.address);
    });

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
      
      await expect(multisendTx).to.be.revertedWith(
        "GNBU::_transferTokens: transfer amount exceeds balance"
      )
    });

    it("multisend to delegator1 and delegator2 (votes check)", async function () {
      const balance1_before_multisend = await this.token.availableForTransfer(delegator1.address)
      const balance2_before_multisend = await this.token.availableForTransfer(delegator1.address)
      const votes_before_multisend = await this.token.getCurrentVotes(delegatee.address)

      let total_balance = balance1_before_multisend + balance2_before_multisend
      expect(total_balance = votes_before_multisend)

      await this.token.multisend([delegator1.address, delegator2.address], [INVESTMENT, INVESTMENT], {
        from: initialHolder.address,
      });

      const balance1_after_multisend = await this.token.availableForTransfer(delegator1.address)
      const balance2_after_multisend = await this.token.availableForTransfer(delegator1.address)
      total_balance = (Number(balance1_after_multisend) + Number(balance2_after_multisend)).toString()

      expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
        BigNumber.from(total_balance))
    });
  });

  describe("delegate", function () {
    it("to zero address", async function () {
      await expect(this.token.connect(initialHolder).delegate(ZERO_ADDRESS))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, ZERO_ADDRESS, ZERO_ADDRESS);
    });

    it("votes not added when delegator without balance", async function () {
      const votes_before_delegation = await this.token.getCurrentVotes(delegatee.address)
      
      await expect(this.token.connect(delegator1).delegate(delegatee.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(delegator1.address, ZERO_ADDRESS, delegatee.address);

      expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
        votes_before_delegation
      );
    });

    it("delegate twice to same address", async function () {
      
      await expect(this.token.connect(initialHolder).delegate(delegatee.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, ZERO_ADDRESS, delegatee.address)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(delegatee.address, 0, initialSupply);

      const votes_before_second_delegation = await this.token.getCurrentVotes(delegatee.address)

      await expect(this.token.connect(initialHolder).delegate(delegatee.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, delegatee.address, delegatee.address)
      
      expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
        votes_before_second_delegation
      );
    });

    it("transfer tokens after delegation", async function () {
      await expect(this.token.connect(initialHolder).delegate(delegatee.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, ZERO_ADDRESS, delegatee.address)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(delegatee.address, 0, initialSupply);

      await expect(this.token.connect(initialHolder).transfer(recipient.address, initialSupply))
        .to.emit(this.token, 'Transfer')
        .withArgs(initialHolder.address, recipient.address, initialSupply)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(delegatee.address, initialSupply, 0);
      
      expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
        0
      );

      expect(await this.token.getCurrentVotes(recipient.address)).to.equal(
        0
      );

      await expect(this.token.connect(recipient).delegate(recipient.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(recipient.address, ZERO_ADDRESS, recipient.address)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(recipient.address, 0, initialSupply);

      expect(await this.token.getCurrentVotes(recipient.address)).to.equal(
        initialSupply
      );
    });

    it("nested delegation", async function () {
      await expect(this.token.connect(initialHolder).delegate(delegatee.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, ZERO_ADDRESS, delegatee.address)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(delegatee.address, 0, initialSupply);

      await expect(this.token.connect(initialHolder).delegate(recipient.address))
        .to.emit(this.token, 'DelegateChanged')
        .withArgs(initialHolder.address, delegatee.address, recipient.address)
        .to.emit(this.token, 'DelegateVotesChanged')
        .withArgs(delegatee.address, initialSupply, 0);

        expect(await this.token.getCurrentVotes(delegatee.address)).to.equal(
          0
        );

        expect(await this.token.getCurrentVotes(recipient.address)).to.equal(
          initialSupply
        );

    });
  });

  

  describe("freeCirculation and supportUnits", function () {
    let supportUnits = []
    beforeEach(async function () {
      supportUnits = [initialHolder.address, recipient.address];
    });

    it("freeCirculation", async function () {
      expect(await this.token.freeCirculation()).to.equal(0);

      await this.token.connect(initialHolder).transfer(recipient.address, INVESTMENT);

      expect(await this.token.freeCirculation()).to.equal(
        INVESTMENT
      );
    });

    it("support units", async function () {
      await this.token.transfer(recipient.address, INVESTMENT);

      await this.token.updateSupportUnitAdd(supportUnits[0]);
      await this.token.updateSupportUnitAdd(supportUnits[1]);

      const tx = this.token.updateSupportUnitAdd(supportUnits[1]);
      await expect(tx)
        .to.be.revertedWith("GNBU::updateSupportUnitAdd: support unit exists")

      await this.token.updateSupportUnitRemove(1);

    });
  });

  describe("getPriorVotes", function () {
    it("reject for not determinate block", async function () {
      const latest_block = await time.latestBlock();
      
      const getPriorVotesTx = this.token.getPriorVotes(initialHolder.address, latest_block);
      await expect(getPriorVotesTx)
        .to.be.revertedWith("GNBU::getPriorVotes: not yet determined")
    });

    it("without checkpoints", async function () {
      const latest_block = await time.latestBlock();

      expect(await this.token.connect(initialHolder).getPriorVotes(
        initialHolder.address, 
        latest_block - 1
      )).to.equal(0)
    });

    it("when block earlier than first checkpoint", async function () {
      const block_before_delegation = await time.latestBlock();
      
      await mine(10);

      const delegateTx = await this.token.delegate(recipient.address);

      expect(await this.token.connect(initialHolder).getPriorVotes(
        recipient.address, 
        block_before_delegation - 1
      )).to.equal(0);

    });

    it("getPriorVotes after delegation", async function () {
      await mine(10);

      const delegateTx = await this.token.delegate(recipient.address);
      const latest_block = await time.latestBlock(); 
      await mine();

      expect(await this.token.connect(initialHolder).getPriorVotes(
        recipient.address, 
        latest_block
      )).to.equal(initialSupply);
    });
  });
});
})