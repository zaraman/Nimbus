// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

library TransferHelper {
    function safeApprove(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
    }

    function safeTransfer(address token, address to, uint value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    function safeTransferBNB(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'TransferHelper: BNB_TRANSFER_FAILED');
    }
}

interface INimbusReferralProgramUsers {
    function userSponsor(uint user) external view returns (uint);
    function registerUser(address user, uint category) external returns (uint);
    function registerUserBySponsorAddress(address user, address sponsorAddress, uint category) external returns (uint);
    function registerUserBySponsorId(address user, uint sponsorId, uint category) external returns (uint);
    function userIdByAddress(address user) external view returns (uint);
    function userAddressById(uint id) external view returns (address);
    function userSponsorAddressByAddress(address user) external view returns (address);
    function getUserReferrals(address user) external view returns (uint[] memory);
}

interface IInitial {
    function SYSTEM_TOKEN() external view returns (address);
    function getSystemTokenAmountForToken(address token, uint tokenAmount) external view returns (uint);
}

interface INimbusVesting {
    struct VestingInfo {
        uint vestingAmount;
        uint unvestedAmount;
        uint vestingType;
        uint vestingStart;
        uint vestingReleaseStartDate;
        uint vestingEnd;
        uint vestingSecondPeriod;
    }
    function vestingInfos(address user, uint nonce) external view returns (VestingInfo memory);
    function vestingNonces(address user) external view returns (uint);
}

interface IBEP165 {
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

abstract contract ERC165 is IBEP165 {
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IBEP165).interfaceId;
    }
}

interface IBEP721 is IBEP165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;
}

interface IStakingMain is IBEP721 {
    function buySmartStaker(uint256 _setNum, uint _amount) external payable;
    function withdrawReward(uint256 _id) external;
    function tokenCount() external view returns(uint);
    function getUserTokens(address user) external view returns (uint[] memory);
}

contract NimbusReferralProgramMarketingStorage is OwnableUpgradeable {  
        struct Qualification {
            uint Number;
            uint TotalTurnover; 
            uint Percentage; 
            uint FixedReward;
            uint MaxUpdateLevel;
        }

        struct UpgradeInfo {
            uint date;
            uint prevLevel;
            uint nextLevel;
            string hash;
            address nftFixedReward;
            uint fixedRewardTokenId;
            uint fixedRewardAmount;
            uint variableRewardAmount;
            uint nimbRewardAmount;
        }

        mapping (address => uint) public upgradeNonces;
        mapping (address => mapping (uint => UpgradeInfo)) public upgradeInfos;

        IERC20Upgradeable public paymentToken;
        INimbusReferralProgramUsers rpUsers;
        IStakingMain public nftSmartStaker;

        uint constant SMART_STAKER_SET = 0;

        uint public totalFixedAirdropped;
        uint public totalVariableAirdropped;
        uint public airdropProgramCap;

        uint constant PERCENTAGE_PRECISION = 1e5;
        uint constant MARKETING_CATEGORY = 3;
        uint constant REFERRAL_LINES = 1;

        mapping(address => bool) public isRegionManager;
        mapping(address => bool) public isHeadOfLocation;
        mapping(address => address) public userHeadOfLocations;
        mapping(address => address) public headOfLocationRegionManagers;
        address[] public regionalManagers;
        address[] public headOfLocations;

        mapping(address => uint) public headOfLocationTurnover; //contains the whole structure turnover (more than 6 lines), including userStructureTurnover (only 6 lines turnover)
        mapping(address => uint) public regionalManagerTurnover;
        mapping(address => uint) public userPersonalTurnover;
        mapping(address => uint) public userQualificationLevel;
        mapping(address => uint) public userQualificationOrigin; //0 - organic, 1 - imported, 2 - set
        mapping(address => uint) public userMaxLevelPayment;
        mapping(address => uint) public userUpgradeAllowedToLevel;

        mapping(address => uint) public userMaxLevelPaymentNonce;

        uint public qualificationsCount;
        mapping(uint => Qualification) public qualifications;

        mapping(address => bool) public isAllowedContract;
        mapping(address => bool) public registrators;
        mapping(address => bool) public allowedUpdaters;
        mapping(address => bool) public allowedVerifiers;

        uint public levelLockPeriod;

        event Rescue(address indexed to, uint amount);
        event RescueToken(address indexed token, address indexed to, uint amount);

        event AirdropFixedReward(address indexed user, address nftContract, uint nftTokenId, uint fixedAirdropped, uint indexed qualification);
        event AirdropVariableReward(address indexed user, uint variableAirdropped, uint indexed qualification);
        event AirdropNIMBReward(address indexed user, uint busdEquivalent, uint nimbAirdropped, uint indexed qualification);

        event QualificationUpdated(address indexed user, uint indexed previousQualificationLevel, uint indexed qualificationLevel, uint systemFee);

        event UserRegistered(address user, uint indexed sponsorId);
        event UserRegisteredWithoutHeadOfLocation(address user, uint indexed sponsorId);

        event LevelLockPeriodSet(uint levelLockPeriod);
        event PendingQualificationUpdate(address indexed user, uint indexed previousQualificationLevel, uint indexed qualificationLevel);

        event UpdateReferralProfitAmount(address indexed user, uint amount, uint indexed line);
        event UpdateHeadOfLocationTurnover(address indexed headOfLocation, uint amount);
        event UpdateRegionalManagerTurnover(address indexed regionalManager, uint amount);
        event UpdateAirdropProgramCap(uint indexed newAirdropProgramCap);
        event UpdateQualification(uint indexed index, uint indexed totalTurnoverAmount, uint indexed percentage, uint fixedReward, uint maxUpdateLevel);
        event AddHeadOfLocation(address indexed headOfLocation, address indexed regionalManager);
        event RemoveHeadOfLocation(address indexed headOfLocation);
        event AddRegionalManager(address indexed regionalManager);
        event RemoveRegionalManager(address indexed regionalManager);
        event UpdateRegionalManager(address indexed user, bool indexed isManager);
        event ImportUserTurnoverSet(address indexed user, uint personalTurnoverSystemToken, uint personalTurnoverPaymentToken);
        event ImportUserMaxLevelPayment(address indexed user, uint maxLevelPayment, bool indexed addToCurrentPayment);
        event AllowLevelUpgradeForUser(address indexed user, uint currentLevel, uint allowedLevel);
        event ImportUserTurnoverUpdate(address indexed user, uint newPersonalTurnoverAmount, uint previousPersonalTurnoverAmount);
        event ImportHeadOfLocationTurnoverUpdate(address indexed headOfLocation, uint previousTurnover, uint newTurnover);
        event ImportHeadOfLocationTurnoverSet(address indexed headOfLocation, uint turnover);
        event ImportRegionalManagerTurnoverUpdate(address indexed headOfLocation, uint previousTurnover, uint newTurnover);
        event ImportRegionalManagerTurnoverSet(address indexed headOfLocation, uint turnover);
        event ImportUserHeadOfLocation(address indexed user, address indexed headOfLocation);
        event UpgradeUserQualification(address indexed user, uint indexed previousQualification, uint indexed newQualification, uint newStructureTurnover);

        event UpdateNFTSmartStakerContract(address indexed nftSmartStakerAddress);

        event AirdropManualReward(address indexed user, address token, uint amount, uint indexed qualification);
        event UpdateAllowedOnetimeBonusReceiver(address indexed user, bool isAllowed);
    }