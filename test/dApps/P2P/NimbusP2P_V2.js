const {ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { signERC2612Permit } = require ('../../utils/eth-permit');
const { time } = require("@nomicfoundation/hardhat-network-helpers");

let p2p;
let busd;
let wbnb;
let nbu;
let smartLP;
let smartStakerContract;
let curTimestamp;

describe('NimbusP2P', () => {
    beforeEach(async () => {
        [owner, other, user2, ...accounts] = await ethers.getSigners();

        const WBNB = await ethers.getContractFactory('NBU_WBNB')
        wbnb = await WBNB.deploy();

        const BUSD = await ethers.getContractFactory('BUSDTest')
        busd = await BUSD.deploy();

        const NBU = await ethers.getContractFactory('contracts/mocks/MockForP2P/NBU.sol:NBU')
        nbu = await NBU.deploy();

        const SmartLp = await ethers.getContractFactory('MockSmartLP')
        smartLP = await upgrades.deployProxy(SmartLp, [wbnb.address, busd.address])
        await smartLP.deployed()

        const SmartStaker = await ethers.getContractFactory('MockStakingMain')
        smartStakerContract = await SmartStaker.deploy(wbnb.address)
        await smartStakerContract.deployed()

        const P2P = await ethers.getContractFactory('NimbusP2P_V2');
        p2p = await upgrades.deployProxy(P2P, [
            [busd.address, nbu.address],
            [true, true],
            [smartStakerContract.address],
            [true],
            wbnb.address,
        ])
        await p2p.deployed();

        curTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
    })

    it('cancelTrade', async () => {
        const [owner] = await ethers.getSigners();
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');

        await p2p.createTradeEIP20ToEIP20(
            busd.address,
            proposedAmount, nbu.address,
            '10000000000000000000',
            curTimestamp + 100,
        )
        const balanceBefore = await busd.balanceOf(owner.address);
        const tradeId = 1;
        // Ensure state is active
        expect(await p2p.state(tradeId)).to.equals(0)

        await expect(p2p.cancelTrade(tradeId))
            .to.emit(p2p, 'CancelTrade')
            .withArgs(tradeId);

        // Next be sure trade cancelled
        expect(await p2p.state(tradeId)).to.equals(2)
        const balanceAfter = await busd.balanceOf(owner.address);

        expect(balanceAfter.sub(balanceBefore)).to.equals(proposedAmount);
    })

    it('cancelTrade non-existing tradeId', async () => {
        const tradeId = 1;

        await expect(p2p.cancelTrade(tradeId))
            .to.be.revertedWith('NimbusP2P_V2: Invalid trade id');
    })

    it('state', async () => {
        const tradeId = 1;

        // state of non-exiting trade
        await expect(p2p.state(tradeId)).to.be.revertedWith('NimbusP2P_V2: Invalid trade id');

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');
        await p2p.createTradeEIP20ToEIP20(
            busd.address,
            proposedAmount,
            nbu.address,
            '10000000000000000000',
            curTimestamp + 100,
        )

        // ensure trade is active
        expect(await p2p.state(tradeId)).to.equals(0);
    })

    it('stateMulti', async () => {
        const tradeId = 1;

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');
        await p2p.createTradeEIP20ToEIP20(busd.address, proposedAmount, nbu.address, '10000000000000000000', curTimestamp + 100)

        expect(await p2p.state(tradeId)).to.equals(0);
    })

    it('userTrades', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');
        await p2p.createTradeEIP20ToEIP20(busd.address, proposedAmount, nbu.address, '10000000000000000000', curTimestamp + 100)

        let userTradeIds = await p2p.userTrades(owner.address);

        ['1'].forEach((x, i) => {
            expect(userTradeIds[i]).to.equals(x);
        })

        // Create another trade now
        await p2p.createTradeEIP20ToEIP20(busd.address, proposedAmount, nbu.address, '10000000000000000000', curTimestamp + 100)

        userTradeIds = await p2p.userTrades(owner.address);

        ['1', '2'].forEach((x, i) => {
            expect(userTradeIds[i]).to.equals(x);
        })
    })

    it('createTradeEIP20ToNFT', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');
        const balanceBefore = await busd.balanceOf(owner.address);

        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await expect(p2p.createTradeEIP20ToNFT(busd.address, proposedAmount, smartStakerContract.address, tokenId, curTimestamp + 100))
            .to.emit(p2p, 'NewTradeSingle')
            .withArgs(owner.address, busd.address, proposedAmount, '0', smartStakerContract.address, '0', '1', curTimestamp + 100, '1');

        // check balance after
        const balanceAfter = await busd.balanceOf(owner.address);

        expect(balanceBefore.sub(balanceAfter)).to.equals(proposedAmount);
    })

    it('createTradeEIP20ToNFT with not enough balance', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('10000000000000000000000000000000000000000000000000000000');

        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await expect(p2p.createTradeEIP20ToNFT(
            busd.address,
            proposedAmount,
            smartStakerContract.address,
            tokenId,
            curTimestamp + 100
        )).to.be.revertedWith('TransferHelper: TRANSFER_FROM_FAILED');
    })

    it('createTradeNFTtoEIP20', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const askedAmount = ethers.BigNumber.from('1000000000000000000');

        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await smartStakerContract.approve(p2p.address, tokenId);

        await expect(p2p.createTradeNFTtoEIP20(smartStakerContract.address, tokenId, busd.address, askedAmount, curTimestamp + 100))
            .to.emit(p2p, 'NewTradeSingle')
            .withArgs(owner.address, smartStakerContract.address, '0', '1', busd.address, askedAmount, '0', curTimestamp + 100, '1');

        expect(await smartStakerContract.ownerOf(tokenId)).to.equals(p2p.address);
    })

    it('createTradeBNBtoNFT', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);

        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await smartStakerContract.approve(p2p.address, tokenId);

        const wbnbValue = '1000000000000000000000';

        await expect(p2p.createTradeBNBtoNFT(smartStakerContract.address, tokenId, curTimestamp + 100, { value: wbnbValue }))
            .to.emit(p2p, 'NewTradeSingle')
            .withArgs(owner.address, wbnb.address, wbnbValue, '0', smartStakerContract.address, '0', '1', curTimestamp + 100, '1');
    })

    it('supportTradeSingle after createTradeEIP20ToNFT', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');

        const tradeId = 1;
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await expect(p2p.createTradeEIP20ToNFT(
            busd.address,
            proposedAmount,
            smartStakerContract.address,
            tokenId,
            curTimestamp + 100,
        )).to.emit(p2p, 'NewTradeSingle').withArgs(
            owner.address,
            busd.address,
            proposedAmount,
            '0',
            smartStakerContract.address,
            '0',
            '1',
            curTimestamp + 100,
            '1',
        );

        // Now support it
        await smartStakerContract.approve(p2p.address, tokenId);
        expect(await p2p.state(tradeId)).to.equals(0) // Active

        await p2p.supportTradeSingle(tradeId);
        expect(await p2p.state(tradeId)).to.equals(1) // Succeeded
    })

    it('supportTradeSingle after createTradeNFTtoEIP20', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const askedAmount = ethers.BigNumber.from('1000000000000000000');

        const tradeId = 1;
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await smartStakerContract.approve(p2p.address, tokenId);

        await expect(p2p.createTradeNFTtoEIP20(smartStakerContract.address, tokenId, busd.address, askedAmount, curTimestamp + 100))
            .to.emit(p2p, 'NewTradeSingle')
            .withArgs(owner.address, smartStakerContract.address, '0', '1', busd.address, askedAmount, '0', curTimestamp + 100, '1');

        // Now support it
        await busd.approve(p2p.address, askedAmount);
        expect(await p2p.state(tradeId)).to.equals(0) // Active

        await p2p.supportTradeSingle(tradeId);
        expect(await p2p.state(tradeId)).to.equals(1) // Succeeded
    })

    it('supportTradeSingle after createTradeNFTtoEIP20 without approve', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const askedAmount = ethers.BigNumber.from('1000000000000000000');
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await expect(p2p.createTradeNFTtoEIP20(smartStakerContract.address, tokenId, busd.address, askedAmount, curTimestamp + 100))
            .to.be.revertedWith('ERC721: transfer caller is not owner nor approved')
    })

    it('withdrawOverdueAssetSingle', async () => {
        const [owner] = await ethers.getSigners();

        // Create trade now
        await busd.approve(p2p.address, ethers.constants.MaxUint256);
        const tradeId = 1;
        const proposedAmount = ethers.BigNumber.from('1000000000000000000');
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })

        await expect(p2p.createTradeEIP20ToNFT(
            busd.address,
            proposedAmount,
            smartStakerContract.address,
            tokenId,
            curTimestamp + 100,
        )).to.emit(p2p, 'NewTradeSingle').withArgs(
            owner.address,
            busd.address,
            proposedAmount,
            '0',
            smartStakerContract.address,
            '0',
            '1',
            curTimestamp + 100,
            '1',
        );

        // Now try to withdraw
        await expect(p2p.withdrawOverdueAssetSingle(tradeId))
            .to.be.revertedWith('NimbusP2P_V2: Not available for withdrawal');

        expect(await p2p.state(tradeId)).to.equals(0);

        // Now overdue
        await time.increase(3600)

        await expect(p2p.cancelTrade(tradeId))
            .to.be.revertedWith('NimbusP2P_V2: Not active trade');

        const balanceBefore = await busd.balanceOf(owner.address)
        await p2p.withdrawOverdueAssetSingle(tradeId);
        const balanceAfter = await busd.balanceOf(owner.address)
        expect(await p2p.state(tradeId)).to.equals(3);

        await expect(p2p.cancelTrade(tradeId)).to.be.revertedWith('NimbusP2P_V2: Not active trade');

        expect(balanceAfter.sub(balanceBefore)).to.equal(proposedAmount);
    })

    it('supportTradeMultiWithPermit', async function () {
        const [owner] = await ethers.getSigners();

        // Create trade now
        const askedAmount = ethers.BigNumber.from('10000000000000000000');
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        const tradeId = 1;
        await smartStakerContract.buySmartStaker('1','1',{ value: ethers.utils.parseUnits('1.0') })
        await smartStakerContract.approve(p2p.address, tokenId);
        await busd.approve(p2p.address, ethers.constants.MaxUint256);

        const result = await signERC2612Permit(
            ethers.provider,
            busd.address,
            owner.address,
            p2p.address,
            askedAmount.toString(),
            ethers.constants.MaxUint256.toString(),
        );

        await expect(p2p.createTradeNFTsToEIP20(
            [smartStakerContract.address],
            [tokenId],
            busd.address,
            askedAmount,
            curTimestamp + 100,
        )).to.emit(p2p, 'NewTradeMulti')
        expect(await p2p.stateMulti(tradeId)).to.equals(0);
        await expect(p2p.state(tradeId)).to.be.revertedWith('NimbusP2P_V2: Invalid trade id');

        await p2p.supportTradeMultiWithPermit(
            tradeId,
            ethers.constants.MaxUint256,
            result.v,
            result.r,
            result.s,
        )

        expect(await p2p.stateMulti(tradeId)).to.equals(1);
    })

    it('supportTradeMultiWithPermit invalid sig', async function () {
        const [owner] = await ethers.getSigners();

        // Create trade
        const tradeId = 1;
        const askedAmount = ethers.BigNumber.from('10000000000000000000');
        const tokenId = (await smartStakerContract.tokenCount()).add(ethers.BigNumber.from(1));
        await smartStakerContract.buySmartStaker('1', '1', { value: ethers.utils.parseUnits('1.0') })
        await smartStakerContract.approve(p2p.address, tokenId);
        await busd.approve(p2p.address, ethers.constants.MaxUint256);

        const result = await signERC2612Permit(
            ethers.provider,
            busd.address,
            owner.address,
            p2p.address,
            askedAmount.toString(),
            ethers.constants.MaxUint256.toString(),
        );

        // Some invalid signature data
        result.r = '0x5f184231b83add6fc68f7007b0f00b91b79224f1a39b69d6e5125ad532e2891b';

        await expect(p2p.createTradeNFTsToEIP20(
            [smartStakerContract.address],
            [tokenId],
            busd.address,
            askedAmount,
            curTimestamp + 100,
        )).to.emit(p2p, 'NewTradeMulti');
        expect(await p2p.stateMulti(tradeId)).to.equals(0);
        await expect(p2p.state(tradeId)).to.be.revertedWith('NimbusP2P_V2: Invalid trade id');

        await expect(p2p.supportTradeMultiWithPermit(
            tradeId,
            ethers.constants.MaxUint256,
            result.v,
            result.r,
            result.s,
        )).to.be.revertedWith('NBU::permit: unauthorized');

        expect(await p2p.stateMulti(tradeId)).to.equals(0);
    })
})
