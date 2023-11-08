const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS } = constants;
const timeHelper = require("../utils/timeHelpers");
const { DAY, ZERO } = require("../utils/constants");
const {ethers} = require("hardhat");
const {utf8ToHex} = require("truffle/build/653.bundled");
const { mine, mineUpTo} = require("@nomicfoundation/hardhat-network-helpers");

describe("NimbusGovernorV1", () => {
  let accounts;
  let gnbu;
  let pool;
  let governor;
  let owner, client;
  const clientAllowance = new BN(10000);
  const _votingDelay = new BN(1);
  const _votingPeriod = new BN(13);
  const stakeValue = new BN(3000);

  const ProposalState = {
    Pending: new BN(0),
    Active: new BN(1),
    Canceled: new BN(2),
    Defeated: new BN(3),
    Succeeded: new BN(4),
    Executed: new BN(5),
  };

  async function createProposal(contract, token, p) {
    const proposal = p
        ? p
        : {
          targets: [gnbu.address],
          values: [ZERO.toString()],
          signatures: ["transferFrom(address,address,uint256)"],
          calldatas: [
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "uint256"],
                [owner.address, client.address, 1000]
            ),
          ],
          description: "description 1",
        };

    return await governor.propose(...Object.values(proposal));
  }

  beforeEach(async function () {
    const [owner_, client_, ...accounts_] = await ethers.getSigners();
    owner = owner_;
    client = client_;
    accounts = accounts_;

    const GNBU = await ethers.getContractFactory("GNBU");
    gnbu = await GNBU.deploy();

    const Pool = await ethers.getContractFactory("LockStakingRewardsSameTokenFixedAPY");
    pool = await Pool.deploy(gnbu.address, 100, 86400);

    const NimbusGovernorV1 = await ethers.getContractFactory("NimbusGovernorV1Test");
    governor = await NimbusGovernorV1.deploy(gnbu.address, [pool.address]);

    await gnbu.transfer(client.address, clientAllowance.toString());

    await gnbu.connect(owner).approve(pool.address, new BN(100000).toString());
    await gnbu.connect(client).approve(pool.address, clientAllowance.toString());
    await gnbu.approve(governor.address, clientAllowance.muln(2).toString());
  });

  describe("propose", function () {
    describe("when proposer doesnt have enough votes", function () {
      it("reject", async function () {
        const proposeTx = governor.propose(
            [gnbu.address],
            ['100'],
            ['transfer (address, uint)'],
            [ethers.utils.toUtf8Bytes(`${client.address},1000`)],
            'test',
        )

        await expect(proposeTx)
            .to.be.revertedWith('NimbusGovernorV1::propose: proposer votes below participation threshold')
      });
    });

    describe("when proposer has enough votes", function () {
      beforeEach(async function () {
        await gnbu.delegate(owner.address);
      });

      describe("when doesnt stake before", function () {
        it("reject targets is empty", async function () {
          const proposeTx = governor.propose([], [], [], [], "description 1");

          await expect(proposeTx)
              .to.be.revertedWith('NimbusGovernorV1::propose: must provide actions')
        });

        it("reject when different length of data", async function () {
          const proposeTx = governor.propose(
              [gnbu.address, gnbu.address],
              [new BN(100).toString()],
              ["transfer (address, uint)"],
              [ethers.utils.toUtf8Bytes(`${client.address},1000`)],
              "description 1"
          );

          await expect(proposeTx)
              .to.be.revertedWith('NimbusGovernorV1::propose: proposal function information arity mismatch')
        });

        it("reject when too many actions", async function () {
          const propose = {
            targets: [],
            values: [],
            signatures: [],
            calldatas: [],
            description: "description 1",
          };

          for (let index = 0; index <= 10; index++) {
            propose.targets.push(gnbu.address);
            propose.values.push(new BN(100).toString());
            propose.signatures.push("transfer (address, uint)");
            propose.calldatas.push(ethers.utils.toUtf8Bytes(`${client.address},1000`));
          }

          const proposeTx = governor.propose(...Object.values(propose));

          await expect(proposeTx)
              .to.be.revertedWith('NimbusGovernorV1::propose: too many actions')
        });

        it("reject when proposer doesnt have enough stakes tokens", async function () {
          const proposeTx = governor.propose(
              [gnbu.address],
              [new BN(100).toString()],
              ["transfer (address, uint)"],
              [ethers.utils.toUtf8Bytes(`${client.address},1000`)],
              "description 1"
          )

          await expect(proposeTx).to.be.revertedWith('revert')
        });
      });

      describe("when stake before", function () {
        beforeEach(async function () {
          await pool.stake(stakeValue.toString());
        });

        it("success", async function () {
          const propose = {
            targets: [gnbu.address],
            values: [new BN(0).toString()],
            signatures: ["transferFrom(address,address,uint256)"],
            calldatas: [
              ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "uint256"],
                [owner.address, client.address, 1000]
              ),
            ],
            description: "description 1",
          };
          const tx = await governor.propose(...Object.values(propose));

          expect(tx)
              .to.emit(governor, "ProposalCreated")
              .withArgs(
                  propose.targets,
                  propose.signatures,
                  propose.calldatas,
                  propose.description,
                  propose.proposer,
                  propose.startBlock,
                  propose.endBlock,
              )
        });
      });
    });
  });

  describe("execute", function () {
    let quorumVotes;
    let maxVoteWeight;

    beforeEach(async function () {
      await gnbu.delegate(owner.address);
      await pool.stake(stakeValue.toString());
      await gnbu.connect(client).delegate(client.address);

      for (let i = 0; i < accounts.length; i++) {
        const user = accounts[i];
        await gnbu.transfer(user.address, new BN(2000).toString());
        await gnbu.connect(user).delegate(user.address);
      }

      quorumVotes = await governor.quorumVotes();
      maxVoteWeight = await governor.maxVoteWeight();
    });

    it("reject when propose doesnt success", async function () {
      await createProposal(governor.address, gnbu.address);
      const proposalId = '1';

      await expect(governor.execute(proposalId))
          .to.be.revertedWith("NimbusGovernorV1::execute: proposal can only be executed if it is succeeded")
    });

    it("when transaction execution reverted", async function () {
      const propose = {
        targets: [gnbu.address],
        values: [ZERO.toString()],
        signatures: ["invalid(address,address,uint256)"],
        calldatas: [
          ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [owner.address, client.address, 1000]
          ),
        ],
        description: "description 1",
      };

      const propTx = await createProposal(governor.address, gnbu.address, propose);
      const propReceipt = await propTx.wait();
      const proposalId = propReceipt.events[0].args.id;
      const endBlock = propReceipt.events[0].args.endBlock;

      const voteCount = quorumVotes
          .div(maxVoteWeight)
          .add(ethers.BigNumber.from(1))
          .toNumber();

      await mine(1);

      mineUpTo(endBlock.add(ethers.BigNumber.from('1')))

      await expect(governor.execute(proposalId))
          .to.be.revertedWith("NimbusGovernorV1::execute: proposal can only be executed if it is succeeded");
    });

    it("success", async function () {
      const propose = {
        targets: [gnbu.address],
        values: [ZERO.toString()],
        signatures: ["transferFrom(address,address,uint256)"],
        calldatas: [
          ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "uint256"],
              [owner.address, client.address, 1000]
          ),
        ],
        description: "description 1",
      };
      const propTx = await createProposal(governor.address, gnbu.address, propose);
      const propReceipt = await propTx.wait();
      const proposalId = propReceipt.events[0].args.id;
      const endBlock = propReceipt.events[0].args.endBlock;

      const voteCount = quorumVotes
          .div(maxVoteWeight)
          .add(ethers.BigNumber.from('3'))
          .toNumber();
      await mine(1);

      const signers = await ethers.getSigners();

      for (let i = 0; i < voteCount; i++) {
        await governor.connect(signers[i]).castVote(proposalId, true);
      }

      await mineUpTo(endBlock.add(ethers.BigNumber.from('1')))

      const balanceBefore = await gnbu.balanceOf(client.address);
      const execTx = await governor.execute(proposalId);

      expect(execTx)
          .to.emit("ExecuteTransaction")
          .withArgs(
              propose.targets[0],
              propose.values[0],
              propose.signatures[0],
              propose.calldatas[0],
          );

      expect(execTx)
          .to.emit("ProposalExecuted")
          .withArgs(proposalId);

      const balanceAfter = await gnbu.balanceOf(client.address);

      expect(balanceAfter.sub(balanceBefore).toString()).to.equal('1000');
    });
  });

  describe("state", function () {
    // it("when propose doesnt exists", async function () {
    //   const stakeTx = governor.state('1');
    //   await expect(stakeTx)
    //       .to.be.revertedWith("NimbusGovernorV1::state: invalid proposal id")
    // });

    describe("when propose", function () {
      let quorumVotes;
      let maxVoteWeight;

      beforeEach(async function () {
        await gnbu.delegate(owner.address);
        await pool.stake(stakeValue.toString());
        await gnbu.connect(client).delegate(client.address);

        for (let i = 2; i < accounts.length; i++) {
          const user = accounts[i];
          await gnbu.transfer(user.address, new BN(5000).toString());
          await gnbu.connect(user).delegate(user.address);
        }

        quorumVotes = await governor.quorumVotes();
        maxVoteWeight = await governor.maxVoteWeight();

        await createProposal(governor.address, gnbu.address);
      });

      // it("just created = Pending", async function () {
      //   const state = await governor.state('1');
      //
      //   expect(state.toString()).to.be.equal(ProposalState.Pending.toString());
      // });
      //
      // it("after delay = Active", async function () {
      //   await mine(2)
      //
      //   const state = await governor.state('1');
      //
      //   expect(state.toString()).to.be.equal(ProposalState.Active.toString());
      // });

      it("after voting period without enough votes = Defeated", async function () {
        const voteCount = quorumVotes
          .div(maxVoteWeight)
          .sub(ethers.BigNumber.from(1))
          .toNumber();

        await mine(2)

        for (let i = 0; i < 2; i++) {
          await expect(governor.connect(accounts[i]).castVote('1', true))
              .to.be.revertedWith('NimbusGovernorV1::_castVote: voter votes below participation threshold');
        }
      });

      it("after voting period when more users voted against = Defeated", async function () {
        const voteCount = quorumVotes
          .div(maxVoteWeight)
          .add(ethers.BigNumber.from(1))
          .toNumber();

        await mine(2);

        for (let i = 0; i < voteCount; i += 1) {
          await governor.connect(accounts[i+3]).castVote('1', false);
        }

        await mine(1000);
        const state = await governor.state('1');

        expect(state.toString()).to.be.equal(ProposalState.Defeated.toString());
      });

      it("after voting period when more users voted for = Succeeded", async function () {
        const voteCount = quorumVotes
          .div(maxVoteWeight)
          .add(ethers.BigNumber.from(3))
          .toNumber();

        await mine(1);

        await governor.connect(owner).castVote('1', true);
        for (let i = 0; i < voteCount; i++) {
          await governor.connect(accounts[i+2]).castVote('1', true);
        }

        await mine(1000);

        const state = await governor.state('1');
        expect(state.toString()).to.equal(ProposalState.Succeeded.toString());
      });

      it("when proposal is canceled = Canceled", async function () {
        await gnbu.delegate(client.address);
        await mine(1000000); // more than 115 days
        await pool.withdraw(0);

        await governor.cancel('1');
        const state = await governor.state('1');
        expect(state.toString()).to.equal(ProposalState.Canceled.toString());
      });

      it("when proposal is executed = Executed", async function () {
        const voteCount = quorumVotes
          .div(maxVoteWeight)
          .add(ethers.BigNumber.from(3))
          .toNumber();

        await mine(1);

        await governor.connect(owner).castVote('1', true);
        for (let i = 0; i < voteCount; i++) {
          await governor.connect(accounts[i+2]).castVote('1', true);
        }

        await mine(1000)
        await governor.execute('1');

        const state = await governor.state('1');
        expect(state.toString()).to.equal(ProposalState.Executed.toString());
      });
    });
  });

  describe("castVote", function () {
    let proposalId;

    describe("when propose doesnt exist", function () {
      it("reject", async function () {
        await expect(governor.castVote(1, true)).to.be.revertedWith("NimbusGovernorV1::state: invalid proposal id")
      });
    });

    describe("when propose exist", function () {
      beforeEach(async function () {
        await gnbu.delegate(owner.address);
        await pool.stake(stakeValue.toString());
        const propTx = await createProposal(governor.address, gnbu.address);
        const propReceipt = await propTx.wait();

        proposalId = propReceipt.events[0].args.id;
      });

      describe("when voter doesnt have enough votes", function () {
        it("reject ", async function () {
          await mine(1)

          await expect(
              governor.connect(client).castVote(proposalId, true)
          ).to.be.revertedWith("NimbusGovernorV1::_castVote: voter votes below participation threshold");
        });
      });

      describe("when when voter havs enough votes", function () {
        beforeEach(async function () {
          await gnbu.connect(client).delegate(client.address);
        });

        it("success", async function () {
          const castVoteTx = await governor.connect(client).castVote(proposalId, true);

          expect(castVoteTx)
              .to.emit("VoteCast")
              .withArgs(client.address, proposalId)
        });

        it("reject when voter already vote before", async function () {
          await governor.castVote(proposalId, true);

          expect(governor.castVote(proposalId, false))
              .to.be.revertedWith("NimbusGovernorV1::_castVote: voter already voted")
        });

        it("reject when propose is not active", async function () {
          await governor.castVote(proposalId, true);

          expect(governor.castVote(proposalId, false))
              .to.be.revertedWith("NimbusGovernorV1::_castVote: voter already voted")
        });
      });
    });
  });

  describe("cancel", function () {
    let quorumVotes
    let maxVoteWeight
    let proposalId
    let endBlock

    beforeEach(async function () {
      await gnbu.connect(client).delegate(client.address);

      for (let i = 2; i < accounts.length; i++) {
        const user = accounts[i];
        await gnbu.transfer(user.address, new BN(5000).toString());
        await gnbu.connect(user).delegate(user.address);
      }
      await gnbu.delegate(owner.address);
      await pool.stake(stakeValue.toString());

      quorumVotes = await governor.quorumVotes();
      maxVoteWeight = await governor.maxVoteWeight();
      const proposal = {
        targets: [gnbu.address],
        values: [ZERO.toString()],
        signatures: ["transferFrom(address,address,uint256)"],
        calldatas: [
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [owner.address, client.address, 10]
          ),
        ],
        description: "description 1",
      };
      const prop = await createProposal(governor.address, gnbu.address);
      const propTx = await prop.wait();

      proposalId = propTx.events[0].args.id;
      endBlock = propTx.events[0].args.endBlock;
    });

    it("reject when proposer has more than 1% votes", async function () {
      await mine(1)

      await expect(governor.cancel(proposalId))
          .to.be.revertedWith("NimbusGovernorV1::cancel: proposer above threshold")
    });

    it("reject when proposer has more than 0.1% stake tokens", async function () {
      await gnbu.delegate(client.address);
      await mine(1)

      await expect(governor.cancel(proposalId))
          .to.be.revertedWith("NimbusGovernorV1::cancel: proposer above threshold")
    });

    it("success", async function () {
      await gnbu.delegate(client.address);
      await mine(10000000); // more than 15 days
      await pool.withdraw(0);

      const cancelTx = await governor.cancel(proposalId);

      expect(cancelTx)
          .to.emit("ProposalCanceled")
          .withArgs(proposalId)
    });

    it("reject when propose is executed", async function () {
      const voteCount = quorumVotes
        .div(maxVoteWeight)
        .add(ethers.BigNumber.from(3))
        .toNumber();
      await mine(1)

      await governor.connect(owner).castVote(proposalId, true);
      for (let i = 0; i < voteCount; i++) {
        await governor.connect(accounts[i+2]).castVote(proposalId, true);
      }

      await mineUpTo(endBlock.add(ethers.BigNumber.from('1')))
      governor.execute(proposalId);

      await expect(governor.cancel(proposalId))
          .to.be.revertedWith("NimbusGovernorV1::cancel: cannot cancel executed proposal")
    });
  });
});

// contract("NimbusGovernorV1", (accounts) => {
//   const [owner, client] = accounts;
//   const clientAllowance = new BN(10000);
//   const _votingDelay = new BN(1);
//   const _votingPeriod = new BN(13);
//   const stakeValue = new BN(3000);
//
//   function getIdFromEvent(event) {
//     return event.logs[0].args.id;
//   }
//
//
//

//
//
//
//
//
//   beforeEach(async function () {
//     this.token = await GNBU.new();
//     await gnbu.transfer(client, clientAllowance);
//
//     this.pool = await Pool.new(gnbu.address, 100, 86400);
//     await gnbu.approve(pool.address, new BN(100000), {
//       from: owner,
//     });
//
//     await gnbu.approve(pool.address, clientAllowance, {
//       from: client,
//     });
//
//     this.contract = await NimbusGovernorV1.new(gnbu.address, [
//       pool.address,
//     ]);
//
//     await gnbu.approve(governor.address, clientAllowance.muln(2));
//   });
//
//
//   describe("castVote", function () {
//     describe("when propose doesnt exist", function () {
//       it("reject", async function () {
//         await expectRevert(
//           governor.castVote(1, true),
//           "NimbusGovernorV1::state: invalid proposal id"
//         );
//       });
//     });
//
//     describe("when propose exist", function () {
//       beforeEach(async function () {
//         await gnbu.delegate(owner);
//         await pool.stake(stakeValue.toString());
//         const event = await createProposal(governor.address, gnbu.address);
//         this.proposalId = event.logs[0].args.id;
//       });
//
//       describe("when voter doesnt have enough votes", function () {
//         it("reject ", async function () {
//           await time.advanceBlock();
//           await expectRevert(
//             governor.castVote(this.proposalId, true, { from: client }),
//             "NimbusGovernorV1::_castVote: voter votes below participation threshold"
//           );
//         });
//       });
//
//       describe("when when voter havs enough votes", function () {
//         beforeEach(async function () {
//           await gnbu.delegate(client, { from: client });
//         });
//
//         it("succes", async function () {
//           const event = await governor.castVote(this.proposalId, true, {
//             from: client,
//           });
//           expectEvent(event, "VoteCast", {
//             voter: client,
//             proposalId: this.proposalId,
//           });
//         });
//
//         it("reject when voter already vote before", async function () {
//           await governor.castVote(this.proposalId, true);
//           await expectRevert(
//             governor.castVote(this.proposalId, false),
//             "NimbusGovernorV1::_castVote: voter already voted"
//           );
//         });
//
//         it("reject when propose is not active", async function () {
//           await governor.castVote(this.proposalId, true);
//           await expectRevert(
//             governor.castVote(this.proposalId, false),
//             "NimbusGovernorV1::_castVote: voter already voted"
//           );
//         });
//       });
//     });
//   });
//
//   describe("cancel", function () {
//     beforeEach(async function () {
//       await gnbu.delegate(client, { from: client });
//
//       for (let i = 2; i < accounts.length; i++) {
//         const user = accounts[i];
//         await gnbu.transfer(user, new BN(5000));
//         await gnbu.delegate(user, { from: user });
//       }
//       await gnbu.delegate(owner);
//       await pool.stake(stakeValue.toString());
//
//       this.quorumVotes = await governor.quorumVotes();
//       this.maxVoteWeight = await governor.maxVoteWeight();
//       const proposal = {
//         targets: [gnbu.address],
//         values: [ZERO],
//         signatures: ["transferFrom(address,address,uint256)"],
//         calldatas: [
//           utils.defaultAbiCoder.encode(
//             ["address", "address", "uint256"],
//             [owner, client, 10]
//           ),
//         ],
//         description: "description 1",
//       };
//       const event = await createProposal(governor.address, gnbu.address);
//       this.proposalId = event.logs[0].args.id;
//       this.endBlock = event.logs[0].args.endBlock;
//     });
//
//     it("reject when proposer has more than 1% votes", async function () {
//       await time.advanceBlock();
//       await expectRevert(
//         governor.cancel(this.proposalId),
//         "NimbusGovernorV1::cancel: proposer above threshold"
//       );
//     });
//
//     it("reject when proposer has more than 0.1% stake tokens", async function () {
//       await gnbu.delegate(client);
//       await time.advanceBlock();
//       await expectRevert(
//         governor.cancel(this.proposalId),
//         "NimbusGovernorV1::cancel: proposer above threshold"
//       );
//     });
//
//     it("succes", async function () {
//       await gnbu.delegate(client);
//       await time.increase(DAY.muln(15));
//       await pool.withdraw(0);
//
//       const event = await governor.cancel(this.proposalId);
//
//       expectEvent(event, "ProposalCanceled", {
//         id: this.proposalId,
//       });
//     });
//
//     it("reject when propose is executed", async function () {
//       const voteCount = this.quorumVotes
//         .div(this.maxVoteWeight)
//         .addn(1)
//         .toNumber();
//       await time.advanceBlock();
//       for (let i = 0; i < voteCount; i++) {
//         await governor.castVote(this.proposalId, true, {
//           from: accounts[i],
//         });
//       }
//       await time.advanceBlockTo(this.endBlock.addn(1));
//       const execudeEvent = await governor.execute(this.proposalId);
//       await expectRevert(
//         governor.cancel(this.proposalId),
//         "NimbusGovernorV1::cancel: cannot cancel executed proposal"
//       );
//     });
//   });
//
//   describe("execute", function () {
//     beforeEach(async function () {
//       await gnbu.delegate(owner);
//       await pool.stake(stakeValue.toString());
//       await gnbu.delegate(client, { from: client });
//
//       for (let i = 2; i < accounts.length; i++) {
//         const user = accounts[i];
//         await gnbu.transfer(user, new BN(2000));
//         await gnbu.delegate(user, { from: user });
//       }
//
//       this.quorumVotes = await governor.quorumVotes();
//       this.maxVoteWeight = await governor.maxVoteWeight();
//     });
//
//     it("reject when propose doesnt success", async function () {
//       const event = await createProposal(governor.address, gnbu.address);
//       const proposalId = event.logs[0].args.id;
//       await expectRevert(
//         governor.execute(proposalId),
//         "NimbusGovernorV1::execute: proposal can only be executed if it is succeeded"
//       );
//     });
//
//     it("when transaction execution reverted", async function () {
//       const propose = {
//         targets: [gnbu.address],
//         values: [ZERO],
//         signatures: ["invalid(address,address,uint256)"],
//         calldatas: [
//           utils.defaultAbiCoder.encode(
//             ["address", "address", "uint256"],
//             [owner, client, 1000]
//           ),
//         ],
//         description: "description 1",
//       };
//
//       const event = await createProposal(governor.address, this.token, propose);
//       const proposalId = event.logs[0].args.id;
//       const endBlock = event.logs[0].args.endBlock;
//
//       const voteCount = this.quorumVotes
//         .div(this.maxVoteWeight)
//         .addn(1)
//         .toNumber();
//       await time.advanceBlock();
//       for (let i = 0; i < voteCount; i++) {
//         await governor.castVote(proposalId, true, {
//           from: accounts[i],
//         });
//       }
//       await time.advanceBlockTo(endBlock.addn(1));
//
//       await expectRevert(
//         governor.execute(proposalId),
//         "NimbusGovernorV1::executeTransaction: Transaction execution reverted."
//       );
//     });
//
//     it("success", async function () {
//       const propose = {
//         targets: [gnbu.address],
//         values: [ZERO],
//         signatures: ["transferFrom(address,address,uint256)"],
//         calldatas: [
//           utils.defaultAbiCoder.encode(
//             ["address", "address", "uint256"],
//             [owner, client, 1000]
//           ),
//         ],
//         description: "description 1",
//       };
//       const event = await createProposal(governor.address, this.token, propose);
//       const proposalId = event.logs[0].args.id;
//       const endBlock = event.logs[0].args.endBlock;
//
//       const voteCount = this.quorumVotes
//         .div(this.maxVoteWeight)
//         .addn(1)
//         .toNumber();
//       await time.advanceBlock();
//       for (let i = 0; i < voteCount; i++) {
//         await governor.castVote(proposalId, true, {
//           from: accounts[i],
//         });
//       }
//       await time.advanceBlockTo(endBlock.addn(1));
//       const balanceBefore = await gnbu.balanceOf(client);
//       const execudeEvent = await governor.execute(proposalId);
//       expectEvent(execudeEvent, "ExecuteTransaction", {
//         target: propose.targets[0],
//         value: propose.values[0],
//         signature: propose.signatures[0],
//         data: propose.calldatas[0],
//       });
//       expectEvent(execudeEvent, "ProposalExecuted", {
//         id: proposalId,
//       });
//       expect(await gnbu.balanceOf(client)).to.be.bignumber.equal(
//         balanceBefore.addn(1000)
//       );
//     });
//   });
//

// });
