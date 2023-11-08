const { expect } = require("chai");
const { ethers, upgrades, waffle, network } = require("hardhat");
const { both, increaseTime, mineBlock } = require("./Utils");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Test P2P for NFT Contract", function () {

    let curTimestamp;

    beforeEach(async function () {
        [owner, other, user2, ...accounts] = await ethers.getSigners();
        curTimestamp = await time.latest()

        WBNB = await ethers.getContractFactory("NBU_WBNB")
        WbnbContract = await WBNB.deploy();
        await WbnbContract.deployed()

        BUSD = await ethers.getContractFactory("BUSDTest")
        BusdContract = await BUSD.deploy();
        await BusdContract.deployed()

        NBU = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBUContract = await NBU.deploy();
        await NBUContract.deployed()

        NBU2 = await ethers.getContractFactory("contracts/mocks/MockForP2P/NBU.sol:NBU")
        NBU2Contract = await NBU.deploy();
        await NBU2Contract.deployed()

        SmartLp = await ethers.getContractFactory("MockSmartLP")
        SmartLpContract = await upgrades.deployProxy(SmartLp, [WbnbContract.address, BusdContract.address])
        await SmartLpContract.deployed()

        SmartLP2 = await ethers.getContractFactory("MockSmartLP")
        SmartLP2Contract = await upgrades.deployProxy(SmartLP2, [WbnbContract.address, BusdContract.address])
        await SmartLP2Contract.deployed()

        SmartStaker = await ethers.getContractFactory("MockStakingMain")
        SmartStakerContract = await SmartStaker.deploy(WbnbContract.address)
        await SmartStakerContract.deployed()

        P2P = await ethers.getContractFactory("NimbusP2P_V2");
        p2pContract = await upgrades.deployProxy(P2P, [
            [BusdContract.address, NBUContract.address],
            [true, true],
            [SmartStakerContract.address, SmartLpContract.address],
            [true, true],
            WbnbContract.address,
        ])
        await p2pContract.deployed()
    });


    // it("BUSD and NBU should be in allowed list after publish", async function () {
    //     expect(await p2pContract.allowedEIP20(BusdContract.address)).to.equal(true);
    //     expect(await p2pContract.allowedEIP20(NBUContract.address)).to.equal(true);
    //
    //     expect(await p2pContract.allowedEIP20(NBU2Contract.address)).to.equal(false);
    // });
    //
    // it("Any NFT should not be allowed after publish", async function () {
    //     expect(await p2pContract.isAnyNFTAllowed()).to.equal(false);
    // });


    it("Should process trade BNB to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);
        /*  
          await p2pContract.connect(user2).createTradeBNBtoNFTs(
              [SmartLpContract.address, SmartLpContract.address],
              [1, 2],
              curTimestamp + 200,
              { value: ethers.utils.parseUnits("1.0") }
          );
          */

        await expect(p2pContract.connect(user2).createTradeBNBtoNFTs(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200,
            { value: ethers.utils.parseUnits("1.0") }
        )).to.emit(p2pContract, "NewTradeMulti")
            .withArgs(
                user2.address,
                [WbnbContract.address],
                ethers.utils.parseUnits("1.0"),
                [],
                [SmartLpContract.address, SmartLpContract.address],
                0,
                [1, 2],
                curTimestamp + 200,
                1
            );
        //event NewTradeMulti(address indexed user, address[] proposedAssets, uint proposedAmount, uint[] proposedIds, address[] askedAssets, uint askedAmount, uint[] askedIds, uint deadline, uint indexed tradeId);

        // emit NewTradeMulti(msg.sender, proposedAssets, proposedAmount, proposedTokenIds, askedAssets, askedAmount, askedTokenIds, deadline, tradeId);
        const tradeId = 1;

        // await p2pContract.connect(other).supportTradeSingle(tradeId)

        await expect(p2pContract.connect(other).supportTradeMulti(1)).to.emit(p2pContract, "SupportTrade")
            .withArgs(tradeId, other.address);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(2);

        expect(await SmartLpContract.ownerOf(1)).to.equal(user2.address);
        expect(await SmartLpContract.ownerOf(2)).to.equal(user2.address);
        // tradeId = _createTradeMulti(proposedAssets, msg.value, proposedIds, askedAssets, 0, askedTokenIds, deadline, true);
    });

    /*
    function _createTradeMulti(
        address[] memory proposedAssets, 
        uint proposedAmount, 
        uint[] memory proposedTokenIds, 
        address[] memory askedAssets, 
        uint askedAmount, 
        uint[] memory askedTokenIds, 
        uint deadline, 
        bool isNFTsAskedAsset
        //uint tradeType
    ) private whenNotPaused returns (uint tradeId) { 
        require(deadline > block.timestamp, "NimbusP2P_V2: Incorrect deadline");
        tradeId = ++tradeCount;
        
        TradeMulti storage tradeMulti = tradesMulti[tradeId];
        tradeMulti.initiator = msg.sender;
        tradeMulti.proposedAssets = proposedAssets;
        if (proposedAmount > 0) tradeMulti.proposedAmount = proposedAmount;
        if (proposedTokenIds.length > 0) tradeMulti.proposedTokenIds = proposedTokenIds;
        tradeMulti.askedAssets = askedAssets;
        if (askedAmount > 0) tradeMulti.askedAmount = askedAmount;
        if (askedTokenIds.length > 0) tradeMulti.askedTokenIds = askedTokenIds;
        tradeMulti.deadline = deadline;
        if (isNFTsAskedAsset) tradeMulti.isAskedAssetNFTs = true;
        
        _userTrades[msg.sender].push(tradeId);       
        emit NewTradeMulti(msg.sender, proposedAssets, proposedAmount, proposedTokenIds, askedAssets, askedAmount, askedTokenIds, deadline, tradeId);
    }
    */


    it("Should revert when caller does not have NFT when processing trade BNB to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(1);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        await p2pContract.connect(user2).createTradeBNBtoNFTs(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200,
            { value: ethers.utils.parseUnits("1.0") }
        );

        const tradeId = 1;

        // await p2pContract.connect(other).supportTradeSingle(tradeId)
        await expect(p2pContract.connect(other).supportTradeMulti(
            tradeId
        )).to.be.reverted;

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(1);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        expect(await SmartLpContract.ownerOf(1)).to.equal(other.address);
        //   expect(await SmartLpContract.ownerOf(2)).to.equal(user2.address);

    });

    it("Should process multi trade NFTs to ERC20", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);


        await expect(p2pContract.connect(other).createTradeNFTsToEIP20(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            BusdContract.address,
            "1000000000000000000",
            curTimestamp + 200
        )).to.emit(p2pContract, "NewTradeMulti")
            .withArgs(
                other.address,
                [SmartLpContract.address, SmartLpContract.address],
                0,
                [1, 2],
                [BusdContract.address],
                "1000000000000000000",
                [],
                curTimestamp + 200,
                1
            );

        //event NewTradeMulti(address indexed user, address[] proposedAssets, uint proposedAmount, uint[] proposedIds, address[] askedAssets, uint askedAmount, uint[] askedIds, uint deadline, uint indexed tradeId);


        // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

        const tradeId = 1;

        await BusdContract.transfer(user2.address, "1000000000000000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "1000000000000000000");


        await expect(p2pContract.connect(user2).supportTradeMulti(1))
            .to.emit(p2pContract, "SupportTrade")
            .withArgs(tradeId, user2.address);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(2);

    });

    it("Should revert when caller does not have enough tokens processing trade NFTs to EIP20", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        const res = await p2pContract.connect(other).createTradeNFTsToEIP20(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            BusdContract.address,
            "1000000000000000000",
            curTimestamp + 200
        )

        // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

        const tradeId = 1;

        await BusdContract.transfer(user2.address, "1000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "10000000000");



        await expect(p2pContract.connect(user2).supportTradeMulti(
            tradeId
        )).to.be.reverted;

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

    });


    it("Should withdraw overdue assets on multi trade NFTs to ERC20", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        const block = await ethers.provider.getBlock('latest')

        const res = await p2pContract.connect(other).createTradeNFTsToEIP20(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            BusdContract.address,
            "1000000000000000000",
            block.timestamp + 1000
        )

        await time.increase(60 * 60);
        const tradeId = 1;

        await expect(p2pContract.connect(other).withdrawOverdueAssetsMulti(tradeId))
            .to.emit(p2pContract, "WithdrawOverdueAsset")
            .withArgs(tradeId);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

    });

    it("Should withdraw overdue assets on multi trade BNB to NFTs", async function () {
        const block = await ethers.provider.getBlock('latest')

        await expect(p2pContract.connect(user2).createTradeBNBtoNFTs(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            block.timestamp + 1000,
            { value: ethers.utils.parseUnits("1.0") }
        )).to.emit(p2pContract, "NewTradeMulti")
            .withArgs(
                user2.address,
                [WbnbContract.address],
                ethers.utils.parseUnits("1.0"),
                [],
                [SmartLpContract.address, SmartLpContract.address],
                0,
                [1, 2],
                block.timestamp + 1000,
                1
            );

        await time.increase(60 * 60);
        const tradeId = 1;

        await expect(p2pContract.connect(user2).withdrawOverdueAssetsMulti(tradeId))
            .to.emit(p2pContract, "WithdrawOverdueAsset")
            .withArgs(tradeId);
    });

    it("Should withdraw overdue assets on multi trade ERC20 to NFTs", async function () {
        await BusdContract.transfer(other.address, ethers.utils.parseEther("1.0"))
        await BusdContract.connect(other).approve(p2pContract.address, ethers.utils.parseEther("1.0"));


        expect(await BusdContract.balanceOf(other.address)).to.equal(ethers.utils.parseEther("1.0"));

        const block = await ethers.provider.getBlock('latest')

        const res = await p2pContract.connect(other).createTradeEIP20ToNFTs(
            BusdContract.address,
            ethers.utils.parseEther("1.0"),
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            block.timestamp + 1000
        )

        expect(await BusdContract.balanceOf(other.address)).to.equal(0);


        await time.increase(60 * 60);
        const tradeId = 1;

        await expect(p2pContract.connect(other).withdrawOverdueAssetsMulti(tradeId))
            .to.emit(p2pContract, "WithdrawOverdueAsset")
            .withArgs(tradeId);

        expect(await BusdContract.balanceOf(other.address)).to.equal(ethers.utils.parseEther("1.0"));

    });


    it("Should process multi trade ERC20 to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        await BusdContract.transfer(user2.address, "1000000000000000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "1000000000000000000");



        await expect(p2pContract.connect(user2).createTradeEIP20ToNFTs(
            BusdContract.address,
            "1000000000000000000",
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200
        )).to.emit(p2pContract, "NewTradeMulti")
            .withArgs(
                user2.address,
                [BusdContract.address],
                "1000000000000000000",
                [],
                [SmartLpContract.address, SmartLpContract.address],
                0,
                [1, 2],
                curTimestamp + 200,
                1
            );



        // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

        const tradeId = 1;


        await expect(p2pContract.connect(other).supportTradeMulti(1))
            .to.emit(p2pContract, "SupportTrade")
            .withArgs(tradeId, other.address);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(2);

    });

    it("Should process multi trade ERC20 to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        await BusdContract.transfer(user2.address, "1000000000000000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "1000000000000000000");

        const res = await p2pContract.connect(user2).createTradeEIP20ToNFTs(
            BusdContract.address,
            "1000000000000000000",
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200
        )

        // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

        const tradeId = 1;


        await expect(p2pContract.connect(other).supportTradeMulti(1))
            .to.emit(p2pContract, "SupportTrade")
            .withArgs(tradeId, other.address);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(2);

    });

    it("Should not process multi trade after cancelling", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        await BusdContract.transfer(user2.address, "1000000000000000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "1000000000000000000");

        const res = await p2pContract.connect(user2).createTradeEIP20ToNFTs(
            BusdContract.address,
            "1000000000000000000",
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200
        )

        const tradeId = 1;

        await p2pContract.connect(user2).cancelTradeMulti(tradeId)

        await expect(p2pContract.connect(other).supportTradeMulti(
            tradeId
        )).to.be.reverted;


        expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

    });

    it("Should revert when caller does not have enough NFTs processing trade EIP20 to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(1);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

        await BusdContract.transfer(user2.address, "1000000000000000000")
        await BusdContract.connect(user2).approve(p2pContract.address, "1000000000000000000");

        const res = await p2pContract.connect(user2).createTradeEIP20ToNFTs(
            BusdContract.address,
            "1000000000000000000",
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            curTimestamp + 200
        )

        // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

        const tradeId = 1;
        await expect(p2pContract.connect(other).supportTradeMulti(
            tradeId
        )).to.be.reverted;

        expect(await SmartLpContract.balanceOf(other.address)).to.equal(1);
        expect(await SmartLpContract.balanceOf(user2.address)).to.equal(0);

    });

    it("Should process multi trade NFTs to NFTs", async function () {
        await BusdContract.transfer(other.address, "10000000000000000000")
        await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

        await BusdContract.transfer(user2.address, "10000000000000000000")
        await BusdContract.connect(user2).approve(SmartLP2Contract.address, "1000000000000");

        await p2pContract.connect(owner).updateAllowedNFT(SmartLpContract.address, true)
        await p2pContract.connect(owner).updateAllowedNFT(SmartLP2Contract.address, true)


        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 1);
        await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
        await SmartLpContract.connect(other).approve(p2pContract.address, 2);

        await SmartLP2Contract.connect(user2).buySmartLPforToken(100000000000);
        await SmartLP2Contract.connect(user2).approve(p2pContract.address, 1);
        await SmartLP2Contract.connect(user2).buySmartLPforToken(100000000000);
        await SmartLP2Contract.connect(user2).approve(p2pContract.address, 2);

        await expect(p2pContract.connect(other).createTradeNFTsToNFTs(
            [SmartLpContract.address, SmartLpContract.address],
            [1, 2],
            [SmartLP2Contract.address, SmartLP2Contract.address],
            [2, 1],
            curTimestamp + 200
        )).to.emit(p2pContract, "NewTradeMulti")
            .withArgs(
                other.address,
                [SmartLpContract.address, SmartLpContract.address],
                0,
                [1, 2],
                [SmartLP2Contract.address, SmartLP2Contract.address],
                0,
                [2, 1],
                curTimestamp + 200,
                1
            );


        it("Should revert when caller does not have enough NFTs processing trade NFTs to NFTs", async function () {
            await BusdContract.transfer(other.address, "10000000000000000000")
            await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

            await BusdContract.transfer(user2.address, "10000000000000000000")
            await BusdContract.connect(user2).approve(SmartLpContract.address, "1000000000000");


            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 1);
            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 2);

            await SmartLpContract.connect(user2).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(user2).approve(p2pContract.address, 3);


            expect(await SmartLpContract.balanceOf(other.address)).to.equal(2);
            expect(await SmartLpContract.balanceOf(user2.address)).to.equal(1);

            expect(await SmartLpContract.ownerOf(1)).to.equal(other.address);
            expect(await SmartLpContract.ownerOf(2)).to.equal(other.address);
            expect(await SmartLpContract.ownerOf(3)).to.equal(user2.address);


            const res = await p2pContract.connect(other).createTradeNFTsToNFTs(
                [SmartLpContract.address, SmartLpContract.address],
                [1, 2],
                [SmartLpContract.address, SmartLpContract.address],
                [3, 4],
                curTimestamp + 200
            )

            // const tradeId = parseInt(ethers.utils.formatEther( res.value ))

            const tradeId = 1;


            await expect(p2pContract.connect(user2).supportTradeMulti(
                tradeId
            )).to.be.reverted;

            expect(await SmartLpContract.balanceOf(other.address)).to.equal(0);
            expect(await SmartLpContract.balanceOf(user2.address)).to.equal(1);

            expect(await SmartLpContract.ownerOf(3)).to.equal(user2.address);

        });

        it("Should process multi trade NFTs to NFTs,same contracts,same index", async function () {
            await BusdContract.transfer(other.address, "10000000000000000000")
            await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");

            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 1);
            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 2);

            await expect(p2pContract.connect(other).createTradeNFTsToNFTs(
                [SmartLpContract.address, SmartLpContract.address],
                [1, 2],
                [SmartLpContract.address, SmartLpContract.address],
                [1, 2],
                curTimestamp + 200
            )).to.be.revertedWith("NimbusP2P_V2: Asked asset can't be equal to proposed asset");

        });
        it("Should process multi trade NFTs to NFTs,different contracts,same index", async function () {
            await BusdContract.transfer(other.address, "10000000000000000000")
            await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");
            await BusdContract.connect(other).approve(SmartLP2Contract.address, "1000000000000");


            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 1);
            await SmartLP2Contract.connect(other).buySmartLPforToken(100000000000);
            await SmartLP2Contract.connect(other).approve(p2pContract.address, 1);
            await p2pContract.connect(owner).updateAllowedNFT(SmartLpContract.address, true);
            await p2pContract.connect(owner).updateAllowedNFT(SmartLP2Contract.address, true);

            await expect(p2pContract.connect(other).createTradeNFTsToNFTs(
                [SmartLpContract.address],
                [1],
                [SmartLP2Contract.address],
                [1],
                curTimestamp + 200
            )).to.emit(p2pContract, "NewTradeMulti")
                .withArgs(
                    other.address,
                    [SmartLpContract.address],
                    0,
                    [1],
                    [SmartLP2Contract.address],
                    0,
                    [1],
                    curTimestamp + 200,
                    1
                );
        });
        it("Should process multi trade NFTs to NFTs,different contracts,different index", async function () {
            await BusdContract.transfer(other.address, "10000000000000000000")
            await BusdContract.connect(other).approve(SmartLpContract.address, "1000000000000");
            await BusdContract.connect(other).approve(SmartLP2Contract.address, "1000000000000");


            await SmartLpContract.connect(other).buySmartLPforToken(100000000000);
            await SmartLpContract.connect(other).approve(p2pContract.address, 1);
            await SmartLP2Contract.connect(other).buySmartLPforToken(100000000000);
            await SmartLP2Contract.connect(other).buySmartLPforToken(100000000000);
            await SmartLP2Contract.connect(other).approve(p2pContract.address, 2);
            await p2pContract.connect(owner).updateAllowedNFT(SmartLpContract.address, true);
            await p2pContract.connect(owner).updateAllowedNFT(SmartLP2Contract.address, true);

            await expect(p2pContract.connect(other).createTradeNFTsToNFTs(
                [SmartLpContract.address],
                [1],
                [SmartLP2Contract.address],
                [2],
                curTimestamp + 200
            )).to.emit(p2pContract, "NewTradeMulti")
                .withArgs(
                    other.address,
                    [SmartLpContract.address],
                    0,
                    [1],
                    [SmartLP2Contract.address],
                    0,
                    [2],
                    curTimestamp + 200,
                    1
                );
        })
    })
})
