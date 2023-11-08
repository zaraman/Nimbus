const hre = require("hardhat");
const fs = require("fs");
const { ethers, upgrades, waffle } = require("hardhat");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const CHUNK_SIZE = +process.env.STAKING_MIGRATE_CHUNK_SIZE;

function divideChunks(data) {
    let chunks = []
    if (!data) return chunks
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      let res = []
      if (i >= data.length) break
      for (let j = i; j < i + CHUNK_SIZE; j++) {
        if (j >= data.length) break
        res.push(data[j])
      }

      chunks.push(res)
    }
    return chunks
  }

const STAKING_MIGRATE = process.env.STAKING_MIGRATE;
    
async function main() {
    const fNameWallets = `data/${process.env.STAKING_MIGRATE_NAME}`;
    if (!fs.existsSync(fNameWallets)) {
        console.log(`File ${fNameWallets} not exists`);
        return;
    }

    [deployer] = await hre.ethers.getSigners();
    const provider = waffle.provider;

    const allFileContents = fs.readFileSync(fNameWallets, "utf-8");

    
    let objects = [];
    let users = [];
    let nonces = [];
    allFileContents.split(/\r?\n/).forEach((line) => {
        const splitTexts = line.split(',').map(cur=>cur.replace(/['"]+/g, ''));
        if (splitTexts[0].startsWith('wallet') || splitTexts[0].length === 0) return;
        users.push(splitTexts[0])
        nonces.push(splitTexts[1])
        const obj = {
            unlockTime: splitTexts[2],
            stakeTime: splitTexts[3],
            stakingTokenAmount: splitTexts[4],
            rewardsTokenAmount: splitTexts[5],
            rewardRate: splitTexts[6],
        }
        
        objects.push(obj);
    });
    console.log(`Migrating ${objects.length} records`);
    const contractName = 'contracts/contracts_BSC/Staking/LockStakingRewardFixedAPY.sol:LockStakingRewardFixedAPY';
    StakingContract = await ethers.getContractFactory(contractName);
    StakingContractInstance = StakingContract.attach(STAKING_MIGRATE);

    const regChunks = {
        users: divideChunks(users),
        nonces: divideChunks(nonces),
        objects: divideChunks(objects),
      }

      for (let c = 0; c < regChunks.objects.length; c++) {
        const curW = regChunks.users[c]
        const curN = regChunks.nonces[c]
        const curO = regChunks.objects[c]

        const addMigrateTx = await StakingContractInstance.migrateStakeNonceInfos(
            curW, curN, curO
        );
        const receipt = await addMigrateTx.wait();
        console.log(
            `[${c+1}/${regChunks.users.length}] Done TX: ${receipt.transactionHash}`
        );
      }
    
    
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
