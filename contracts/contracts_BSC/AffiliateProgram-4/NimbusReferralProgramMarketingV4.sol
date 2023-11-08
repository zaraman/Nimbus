// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "./NimbusReferralProgramMarketingStorage.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract NimbusReferralProgramMarketingV4 is Initializable, NimbusReferralProgramMarketingStorage {
    address public target;

    mapping(address => bool) public allowedOneTimeBonusReceivers;

    function initialize(address _paymentToken, address _rpUsers, address _smartStaker) public initializer {
        __Ownable_init();
        require(AddressUpgradeable.isContract(_paymentToken), "_paymentToken is not a contract");
        require(AddressUpgradeable.isContract(_rpUsers), "_rpUsers is not a contract");
        require(AddressUpgradeable.isContract(_smartStaker), "_smartStaker is not a contract");

        paymentToken = IERC20Upgradeable(_paymentToken);
        rpUsers = INimbusReferralProgramUsers(_rpUsers);
        nftSmartStaker = IStakingMain(_smartStaker);
        airdropProgramCap = 75_000_000e18;
        levelLockPeriod = 1 days;
    }

    modifier onlyAllowedContract() {
        require(isAllowedContract[msg.sender], "Provided address is not an allowed contract");
        _;
    }

    modifier onlyRegistrators() {
        require(registrators[msg.sender], "Provided address is not a registrator");
        _;
    }

    modifier onlyAllowedUpdaters() {
        require(allowedUpdaters[msg.sender], "Provided address is not a allowed updater");
        _;
    }

    modifier onlyAllowedVerifiers() {
        require(allowedVerifiers[msg.sender], "Provided address is not a allowed verifier");
        _;
    }

    function register(uint sponsorId) external returns (uint userId) {
        return _register(msg.sender, sponsorId);
    }

    function registerUser(address user, uint sponsorId) external onlyRegistrators returns (uint userId) {
        return _register(user, sponsorId);
    }

    function registerBySponsorAddress(address sponsor) external returns (uint userId) {
        uint sponsorId = rpUsers.userIdByAddress(sponsor);
        return _register(msg.sender, sponsorId);
    }

    function registerUserBySponsorAddress(address user, address sponsor) external onlyRegistrators returns (uint userId) {
        uint sponsorId = rpUsers.userIdByAddress(sponsor);
        return _register(user, sponsorId);
    }

    function registerUserBySponsorId(address user, uint sponsorId, uint category) external onlyRegistrators returns (uint userId) {
        return _register(user, sponsorId);
    }

    function updateReferralProfitAmount(address user, uint amount) external onlyAllowedContract {
        require(rpUsers.userIdByAddress(user) != 0, "User is not a part of referral program");

        _updateReferralProfitAmount(user, amount, 0, false);
    }

    function upgradeLevelsLeft(address user, uint potentialLevel) public view returns (uint) {
        uint qualificationLevel = userQualificationLevel[user];
        if (userUpgradeAllowedToLevel[user] >= potentialLevel)
        return potentialLevel;
        else if (userUpgradeAllowedToLevel[user] > qualificationLevel && potentialLevel > userUpgradeAllowedToLevel[user])
        return userUpgradeAllowedToLevel[user];

        uint upgradedLevelsForPeriod;
        if (upgradeNonces[user] > 0)
            {
                for (uint i = upgradeNonces[user]; i > 0; i--) {
                    if (upgradeInfos[user][i].date + levelLockPeriod <= block.timestamp) break;
                    upgradedLevelsForPeriod += upgradeInfos[user][i].nextLevel - upgradeInfos[user][i].prevLevel;
                }
            }
        
        
        uint maxUpdateLevel = qualifications[qualificationLevel].MaxUpdateLevel;

        if (upgradedLevelsForPeriod < maxUpdateLevel) {
            uint toUpgrade = maxUpdateLevel - upgradedLevelsForPeriod;
            if (potentialLevel >= toUpgrade) return qualificationLevel + toUpgrade;
            return potentialLevel;
        }
        return 0;
    }

    function purchaseStakerNFT(address user, uint256 upgradeNonce, uint256 userFixedAirdropAmount) internal returns(uint256 nftTokenId) {
            if(IERC20Upgradeable(paymentToken).allowance(address(this), address(nftSmartStaker)) < userFixedAirdropAmount) {
                IERC20Upgradeable(paymentToken).approve(address(nftSmartStaker), type(uint256).max);
            }
            nftSmartStaker.buySmartStaker(SMART_STAKER_SET, userFixedAirdropAmount);
            nftTokenId = nftSmartStaker.tokenCount();
            nftSmartStaker.safeTransferFrom(address(this), user, nftTokenId);

            upgradeInfos[user][upgradeNonce].nftFixedReward = address(nftSmartStaker);
            upgradeInfos[user][upgradeNonce].fixedRewardTokenId = nftTokenId;
            upgradeInfos[user][upgradeNonce].fixedRewardAmount = userFixedAirdropAmount;
    }

    function getUserLatestUpgrade(address user) external view returns(UpgradeInfo memory userUpgradeInfo) {
        userUpgradeInfo = upgradeInfos[user][upgradeNonces[user]];
    }

    function _processFixedAirdrop(address user, uint256 potentialLevel, uint256 upgradeNonce, uint256 userFixedAirdropAmount) internal {
        if (userFixedAirdropAmount > 0) {
            totalFixedAirdropped += userFixedAirdropAmount;
            uint256 nftTokenId = purchaseStakerNFT(user, upgradeNonce, userFixedAirdropAmount);
            upgradeInfos[user][upgradeNonce].fixedRewardAmount = userFixedAirdropAmount;
            upgradeInfos[user][upgradeNonce].fixedRewardTokenId = nftTokenId;
            upgradeInfos[user][upgradeNonce].nftFixedReward = address(nftSmartStaker);
            emit AirdropFixedReward(user, address(nftSmartStaker), nftTokenId, userFixedAirdropAmount, potentialLevel);
        }
    }

    function _processVariableAirdrop(address user, uint256 potentialLevel, uint256 upgradeNonce, uint256 userVariableAirdropAmount, uint256 systemFee, bool dryRun) internal {
        if (userVariableAirdropAmount > 0) {
            totalVariableAirdropped += userVariableAirdropAmount;
            require(dryRun || userVariableAirdropAmount > systemFee, "No rewards or fee more then rewards");
            TransferHelper.safeTransfer(address(paymentToken), user, userVariableAirdropAmount - systemFee);
            emit AirdropVariableReward(user, userVariableAirdropAmount, potentialLevel);
            upgradeInfos[user][upgradeNonce].variableRewardAmount = userVariableAirdropAmount;
        }
    }

    function _createUpgradeNonce(address user, uint potentialLevel, string memory hash) internal returns(uint256 upgradeNonce) {
        upgradeNonce = ++upgradeNonces[user];
        upgradeInfos[user][upgradeNonce].date = block.timestamp;
        upgradeInfos[user][upgradeNonce].prevLevel = userQualificationLevel[user];
        upgradeInfos[user][upgradeNonce].nextLevel = potentialLevel;
        upgradeInfos[user][upgradeNonce].hash = hash;
    }

    function claimRewards(address user, uint256 userLevel, uint256 structureTurnover, string memory hash, uint256 userVariableAirdropAmount, uint256 systemFee) external onlyAllowedUpdaters {
        bool dryRun = systemFee == 0;
        bool isPartialReward = userLevel == userQualificationLevel[user];
        (uint userFixedAirdropAmount, uint potentialLevel, bool isMaxLevel) = getUserRewards(user, structureTurnover, dryRun || isPartialReward);

        if(isMaxLevel) {
            userMaxLevelPaymentNonce[user] = userLevel - qualificationsCount;
        }

        require(dryRun || isMaxLevel || isPartialReward || potentialLevel > userQualificationLevel[user], "Upgrade not allowed yet");

        uint upgradeNonce = _createUpgradeNonce(user, potentialLevel, hash);

        if (dryRun) {
            potentialLevel = userQualificationLevel[user];
            upgradeNonces[user] -= 1;
            userFixedAirdropAmount = 0;
            userVariableAirdropAmount = 0;
        }

        if (!isPartialReward && allowedOneTimeBonusReceivers[user]) {
            _processFixedAirdrop(user, potentialLevel, upgradeNonce, userFixedAirdropAmount);
        }
        _processVariableAirdrop(user, potentialLevel, upgradeNonce, userVariableAirdropAmount, systemFee, dryRun);

        if (dryRun) return;
        emit QualificationUpdated(user, userQualificationLevel[user], potentialLevel, systemFee);
        userQualificationLevel[user] = potentialLevel;
        if (isMaxLevel) {
            userMaxLevelPayment[user] += userVariableAirdropAmount;
        }
    }

    function manualClaimRewards(address user, uint256 potentialLevel, string memory hash, uint256 userFixedAirdropAmount, uint256 userVariableAirdropAmount, address nbuToken, uint256 userNbuAirdropAmount) external onlyOwner {
        uint upgradeNonce = _createUpgradeNonce(user, potentialLevel, hash);

        _processFixedAirdrop(user, potentialLevel, upgradeNonce, userFixedAirdropAmount);

        _processVariableAirdrop(user, potentialLevel, upgradeNonce, userVariableAirdropAmount, 0, true);

        if (userNbuAirdropAmount > 0 && nbuToken != address(0)) {
            TransferHelper.safeTransferFrom(nbuToken, msg.sender, user, userNbuAirdropAmount);
            emit AirdropManualReward(user, nbuToken, userNbuAirdropAmount, potentialLevel);
        }

        emit QualificationUpdated(user, userQualificationLevel[user], potentialLevel, 0);
        userQualificationLevel[user] = potentialLevel;
    }

    function totalAirdropped() public view returns(uint) {
        return totalFixedAirdropped + totalVariableAirdropped;
    }

    function totalTurnover() public view returns(uint total) {
        for (uint i = 0; i < regionalManagers.length; i++) {
            total += regionalManagerTurnover[regionalManagers[i]];
        }
    }

    function getRegionalManagers() public view returns(address[] memory) {
        return regionalManagers;
    }

    function getHeadOfLocations() public view returns(address[] memory) {
        return headOfLocations;
    }

    function calculateStructureLine(address[] memory referralAddresses, uint256[] memory referalTurnovers) internal pure returns (uint256 structureTurnover) {
        for (uint i = 0; i < referralAddresses.length; i++) structureTurnover += referalTurnovers[i];
    }

    function getUserPotentialQualificationLevel(address user, uint256 structureTurnover) public view returns (uint) {
        uint qualificationLevel = userQualificationLevel[user];
        return _getUserPotentialQualificationLevel(qualificationLevel, structureTurnover);
    }

    function getUserRewards(address user, uint256 structureTurnover, bool noChecks) public view returns (uint userFixed, uint potentialLevel, bool isMaxLevel) {
        require(rpUsers.userIdByAddress(user) > 0, "User not registered");

        uint qualificationLevel = userQualificationLevel[user];
        isMaxLevel = qualificationLevel >= (qualificationsCount - 1);
        
        if (!isMaxLevel) {
            potentialLevel = _getUserPotentialQualificationLevel(qualificationLevel, structureTurnover);
            require(noChecks || potentialLevel > qualificationLevel, "User level not changed");
        } else {
            potentialLevel = qualificationsCount - 1;
        }
        require(noChecks || upgradeLevelsLeft(user, potentialLevel) >= potentialLevel, "No upgrade levels left");

        if (structureTurnover == 0) return (0, potentialLevel, isMaxLevel);
        
        userFixed = _getFixedRewardToBePaidForQualification(structureTurnover, qualificationLevel, potentialLevel);
    }

    function getUserTokens(address user) external view returns (uint[] memory) {
        return nftSmartStaker.getUserTokens(user); 
    }

    function withdrawReward(uint256 _id) external {
        nftSmartStaker.withdrawReward(_id); // withdraw Smart Staker reward
    }

    function _register(address user, uint sponsorId) private returns (uint userId) {
        require(rpUsers.userIdByAddress(user) == 0, "User already registered");
        address sponsor = rpUsers.userAddressById(sponsorId);
        require(sponsor != address(0), "User sponsor address is equal to 0");

        address sponsorAddress = rpUsers.userAddressById(sponsorId);
        if (isHeadOfLocation[sponsorAddress]) {
            userHeadOfLocations[user] = sponsorAddress;
        } else {
            address head = userHeadOfLocations[sponsor];
            if (head != address(0)){
                userHeadOfLocations[user] = head;
            } else {
                emit UserRegisteredWithoutHeadOfLocation(user, sponsorId);
            }
        }
        
        emit UserRegistered(user, sponsorId);   
        return rpUsers.registerUserBySponsorId(user, sponsorId, MARKETING_CATEGORY);
    }

    function _updateReferralProfitAmount(address user, uint amount, uint line, bool isRegionalAmountUpdated) internal {
        if (line == 0) {
            userPersonalTurnover[user] += amount;
            emit UpdateReferralProfitAmount(user, amount, line);
            if (isHeadOfLocation[user]) {
                headOfLocationTurnover[user] += amount;
                address regionalManager = headOfLocationRegionManagers[user];
                regionalManagerTurnover[regionalManager] += amount;
                isRegionalAmountUpdated = true;
            } else if (isRegionManager[user]) {
                regionalManagerTurnover[user] += amount;
                return;
            } else {
                address userSponsor = rpUsers.userSponsorAddressByAddress(user);
                _updateReferralProfitAmount(userSponsor, amount, 1, isRegionalAmountUpdated);
            }
        } else {
            emit UpdateReferralProfitAmount(user, amount, line);
            if (isHeadOfLocation[user]) {
                headOfLocationTurnover[user] += amount;
                address regionalManager = headOfLocationRegionManagers[user];
                if (!isRegionalAmountUpdated) {
                    regionalManagerTurnover[regionalManager] += amount;
                    isRegionalAmountUpdated = true;
                }
            } else if (isRegionManager[user]) {
                if (!isRegionalAmountUpdated) regionalManagerTurnover[user] += amount;
                return;
            }

            if (line >= REFERRAL_LINES) {
                if (!isRegionalAmountUpdated) _updateReferralHeadOfLocationAndRegionalTurnover(user, amount);
                return;
            }

            address userSponsor = rpUsers.userSponsorAddressByAddress(user);
            if (userSponsor == address(0)) {
                if (!isRegionalAmountUpdated) _updateReferralHeadOfLocationAndRegionalTurnover(user, amount);
                return;
            }

            _updateReferralProfitAmount(userSponsor, amount, ++line, isRegionalAmountUpdated);
        }
    }

    function _updateReferralHeadOfLocationAndRegionalTurnover(address user, uint amount) internal {
        address headOfLocation = userHeadOfLocations[user];
        if (headOfLocation == address(0)) return;
        headOfLocationTurnover[headOfLocation] += amount;
        address regionalManager = headOfLocationRegionManagers[user];
        emit UpdateHeadOfLocationTurnover(headOfLocation, amount);
        if (regionalManager == address(0)) return;
        regionalManagerTurnover[regionalManager] += amount;
        emit UpdateRegionalManagerTurnover(regionalManager, amount);
    }

    function _getUserPotentialQualificationLevel(uint qualificationLevel, uint256 turnover) internal view returns (uint) {
        if (qualificationLevel >= qualificationsCount) return qualificationsCount - 1;
        
        for (uint i = qualificationLevel; i < qualificationsCount; i++) {
            if (qualifications[i+1].TotalTurnover > turnover) {
                return i;
            }
        }
        return qualificationsCount - 1; //user gained max qualification
    }

    function _getFixedRewardToBePaidForQualification(uint structureTurnover, uint qualificationLevel, uint potentialLevel) internal view returns (uint userFixed) { 
        if (structureTurnover == 0) return 0;

        for (uint i = qualificationLevel + 1; i <= potentialLevel; i++) {
            uint fixedRewardAmount = qualifications[i].FixedReward;
            if (fixedRewardAmount > 0) {
                userFixed += fixedRewardAmount;
            }
        }
    }

    function updateRegistrator(address registrator, bool isActive) external onlyOwner {
        require(registrator != address(0), "Registrator address is equal to 0");
        registrators[registrator] = isActive;
    }

    function updateAllowedUpdater(address updater, bool isActive) external onlyOwner {
        require(updater != address(0), "Updater address is equal to 0");
        allowedUpdaters[updater] = isActive;
    }

    function updateAllowedVerifier(address verifier, bool isActive) external onlyOwner {
        require(verifier != address(0), "Verifier address is equal to 0");
        allowedVerifiers[verifier] = isActive;
    }

    function updateAllowedContract(address _contract, bool _isAllowed) external onlyOwner {
        require(AddressUpgradeable.isContract(_contract), "Provided address is not a contract");
        isAllowedContract[_contract] = _isAllowed;
    }

    function updateAllowedOneTimeBonusReceivers(address[] memory users, bool[] memory isAllowed) external onlyAllowedVerifiers {
        require(users.length == isAllowed.length, "Arrays length are not equal");
        for (uint i; i < users.length; i++) {
            allowedOneTimeBonusReceivers[users[i]] = isAllowed[i];
            emit UpdateAllowedOnetimeBonusReceiver(users[i], isAllowed[i]);
        }
    }

    function updateQualifications(uint[] memory totalTurnoverAmounts, uint[] memory percentages, uint[] memory fixedRewards, uint[] memory maxUpdateLevels) external onlyOwner {
        require(totalTurnoverAmounts.length == percentages.length && totalTurnoverAmounts.length == fixedRewards.length && totalTurnoverAmounts.length == maxUpdateLevels.length, "Arrays length are not equal");
        qualificationsCount = 0;

        for (uint i; i < totalTurnoverAmounts.length; i++) {
            _updateQualification(i, totalTurnoverAmounts[i], percentages[i], fixedRewards[i], maxUpdateLevels[i]);
        }
        qualificationsCount = totalTurnoverAmounts.length;
    }

    function addHeadOfLocation(address headOfLocation, address regionalManager) external onlyOwner {
        _addHeadOfLocation(headOfLocation, regionalManager);
    }

    function addHeadOfLocations(address[] memory headOfLocation, address[] memory managers) external onlyOwner {
        require(headOfLocation.length == managers.length, "Arrays length are not equal");
        for (uint i; i < headOfLocation.length; i++) {
            _addHeadOfLocation(headOfLocation[i], managers[i]);
        }
    }

    function removeHeadOfLocation(uint index) external onlyOwner {
        require (headOfLocations.length > index, "Incorrect index");
        address headOfLocation = headOfLocations[index];
        headOfLocations[index] = headOfLocations[headOfLocations.length - 1];
        headOfLocations.pop(); 
        isHeadOfLocation[headOfLocation] = false;
        emit RemoveHeadOfLocation(headOfLocation);
    }

    function updateLevelLockPeriod(uint newLevelLockPeriod) external onlyOwner {
        levelLockPeriod = newLevelLockPeriod;
        emit LevelLockPeriodSet(newLevelLockPeriod);
    }

    function addRegionalManager(address regionalManager) external onlyOwner {
        _addRegionalManager(regionalManager);
    }

    function addRegionalManagers(address[] memory managers) external onlyOwner {
        for (uint i; i < managers.length; i++) {
            _addRegionalManager(managers[i]);
        }
    }

    function removeRegionalManager(uint index) external onlyOwner {
        require (regionalManagers.length > index, "Incorrect index");
        address regionalManager = regionalManagers[index];
        regionalManagers[index] = regionalManagers[regionalManagers.length - 1];
        regionalManagers.pop(); 
        isRegionManager[regionalManager] = false;
        emit RemoveRegionalManager(regionalManager);
    }

    function importUserHeadOfLocation(address user, address headOfLocation, bool isSilent) external onlyOwner {
        _importUserHeadOfLocation(user, headOfLocation, isSilent);
    }

    function importUserHeadOfLocations(address[] memory users, address[] memory headOfLocationsLocal, bool isSilent) external onlyOwner {
        require(users.length == headOfLocationsLocal.length, "Array length missmatch");
        for(uint i = 0; i < users.length; i++) {
            _importUserHeadOfLocation(users[i], headOfLocationsLocal[i], isSilent);
        }
    }

    function importBatchUserHeadOfLocations(address[] memory users, address headOfLocationsLocal, bool isSilent) external onlyOwner {
        for(uint i = 0; i < users.length; i++) {
            _importUserHeadOfLocation(users[i], headOfLocationsLocal, isSilent);
        }
    }
    
    function importUserTurnover(address user, uint personalTurnoverSystem, uint personalTurnoverPayment, string memory hash, uint levelHint, bool addToCurrentTurnover, bool updateLevel, bool isSilent) external onlyOwner {
        _importUserTurnover(user, personalTurnoverSystem, personalTurnoverPayment, hash, levelHint, addToCurrentTurnover, updateLevel, isSilent);
    }

    function importUserTurnovers(address[] memory users, uint[] memory personalTurnoversSystem, uint[] memory personalTurnoversPayment, string[] memory hash, uint[] memory levelsHints, bool addToCurrentTurnover, bool updateLevel, bool isSilent) external onlyOwner {
        require(users.length == personalTurnoversSystem.length && users.length == personalTurnoversPayment.length && 
            users.length == levelsHints.length, "Array length missmatch");

        for(uint i = 0; i < users.length; i++) {
            _importUserTurnover(users[i], personalTurnoversSystem[i], personalTurnoversPayment[i], hash[i], levelsHints[i], addToCurrentTurnover, updateLevel, isSilent);
        }
    }

    function importHeadOfLocationTurnover(address headOfLocation, uint turnover, uint levelHint, bool addToCurrentTurnover, bool updateLevel) external onlyOwner {
        _importHeadOfLocationTurnover(headOfLocation, turnover, levelHint, addToCurrentTurnover, updateLevel);
    }

    function importHeadOfLocationTurnovers(address[] memory heads, uint[] memory turnovers, uint[] memory levelsHints, bool addToCurrentTurnover, bool updateLevel) external onlyOwner {
        require(heads.length == turnovers.length, "Array length missmatch");

        for(uint i = 0; i < heads.length; i++) {
            _importHeadOfLocationTurnover(heads[i], turnovers[i], levelsHints[i], addToCurrentTurnover, updateLevel);
        }
    }

    function importRegionalManagerTurnover(address headOfLocation, uint turnover, uint levelHint, bool addToCurrentTurnover, bool updateLevel) external onlyOwner {
        _importRegionalManagerTurnover(headOfLocation, turnover, levelHint, addToCurrentTurnover, updateLevel);
    }

    function importRegionalManagerTurnovers(address[] memory managers, uint[] memory turnovers, uint[] memory levelsHints, bool addToCurrentTurnover, bool updateLevel) external onlyOwner {
        require(managers.length == turnovers.length && managers.length == levelsHints.length, "Array length missmatch");

        for(uint i = 0; i < managers.length; i++) {
            _importRegionalManagerTurnover(managers[i], turnovers[i], levelsHints[i], addToCurrentTurnover, updateLevel);
        }
    }

    function allowLevelUpgradeForUser(address user, uint level) external onlyAllowedVerifiers {
        _allowLevelUpgradeForUser(user, level);
    }

    function _allowLevelUpgradeForUser(address user, uint level) internal {
        require(userQualificationLevel[user] <= level, "Level below current");
        userUpgradeAllowedToLevel[user] = level;
        emit AllowLevelUpgradeForUser(user, userQualificationLevel[user], level);
    }

    function importUserMaxLevelPayment(address user, uint maxLevelPayment, bool addToCurrentPayment) external onlyOwner { 
        _importUserMaxLevelPayment(user, maxLevelPayment, addToCurrentPayment);
    }

    function importUserMaxLevelPayments(address[] memory users, uint[] memory maxLevelPayments, bool addToCurrentPayment) external onlyOwner { 
        require(users.length == maxLevelPayments.length, "Array length missmatch");

        for(uint i = 0; i < users.length; i++) {
            _importUserMaxLevelPayment(users[i], maxLevelPayments[i], addToCurrentPayment);
        }
    }

    


    function _addHeadOfLocation(address headOfLocation, address regionalManager) internal {
        // require(isRegionManager[regionalManager], "Regional manager not exists");
        // require(rpUsers.userIdByAddress(headOfLocation) > 1000000001, "HOL not in referral system or first user");
        headOfLocations.push(headOfLocation);
        isHeadOfLocation[headOfLocation] = true;
        headOfLocationRegionManagers[headOfLocation] = regionalManager;
        emit AddHeadOfLocation(headOfLocation, regionalManager);
    }

    function _addRegionalManager(address regionalManager) internal {
        // require(!isRegionManager[regionalManager], "Regional manager exist");
        // require(rpUsers.userIdByAddress(regionalManager) > 1000000001, "Regional manager not in referral system or first user");
        regionalManagers.push(regionalManager);
        isRegionManager[regionalManager] = true;
        emit AddRegionalManager(regionalManager);
    }

    function _importUserHeadOfLocation(address user, address headOfLocation, bool isSilent) internal onlyOwner {
        // require(isHeadOfLocation[headOfLocation], "Not HOL");
        userHeadOfLocations[user] = headOfLocation;
        if (!isSilent) emit ImportUserHeadOfLocation(user, headOfLocation);
    }

    function _updateQualification(uint index, uint totalTurnoverAmount, uint percentage, uint fixedReward, uint maxUpdateLevel) internal {
        //Total turnover amount can be zero for the first qualification (zero qualification), so check and require is not needed
        qualifications[index] = Qualification(index, totalTurnoverAmount, percentage, fixedReward, maxUpdateLevel);
        emit UpdateQualification(index, totalTurnoverAmount, percentage, fixedReward, maxUpdateLevel);
    }

    function _importUserTurnover(address user, uint personalTurnoverSystemToken, uint personalTurnoverPaymentToken, string memory hash, uint levelHint, bool addToCurrentTurnover, bool updateLevel, bool isSilent) private {
        // require(rpUsers.userIdByAddress(user) != 0, "User is not registered");

        if (addToCurrentTurnover) {
            uint previousPersonalTurnover = userPersonalTurnover[user];
            uint newPersonalTurnover = previousPersonalTurnover + personalTurnoverPaymentToken;
            if (!isSilent) emit ImportUserTurnoverUpdate(user, newPersonalTurnover, previousPersonalTurnover);
            userPersonalTurnover[user] = newPersonalTurnover;
        } else {
            userPersonalTurnover[user] = personalTurnoverPaymentToken;
            if (!isSilent) emit ImportUserTurnoverSet(user, personalTurnoverSystemToken, personalTurnoverPaymentToken);
        }

        uint upgradeNonce = ++upgradeNonces[user];
        upgradeInfos[user][upgradeNonce].date = block.timestamp;
        upgradeInfos[user][upgradeNonce].prevLevel = userQualificationLevel[user];
        if (updateLevel) {
            uint potentialLevel = levelHint;
            if (potentialLevel > 0) {
                userQualificationLevel[user] = potentialLevel;
                // if (!isSilent) emit QualificationUpdated(user, 0, potentialLevel, 0);
            }
        }
        userQualificationOrigin[user] = 1;
        upgradeInfos[user][upgradeNonce].nextLevel = userQualificationLevel[user];
        upgradeInfos[user][upgradeNonce].hash = hash;
    }

    function _importHeadOfLocationTurnover(address headOfLocation, uint turnover, uint levelHint, bool addToCurrentTurnover, bool updateLevel) private {
        require(isHeadOfLocation[headOfLocation], "User is not HOL");

        uint actualTurnover;
        if (addToCurrentTurnover) {
            uint previousTurnover = headOfLocationTurnover[headOfLocation];

            actualTurnover = previousTurnover + turnover;
            emit ImportHeadOfLocationTurnoverUpdate(headOfLocation, previousTurnover, actualTurnover);
            headOfLocationTurnover[headOfLocation] = actualTurnover;
        } else {
            headOfLocationTurnover[headOfLocation] = turnover;
            emit ImportHeadOfLocationTurnoverSet(headOfLocation, turnover);
            actualTurnover = turnover;
        }

        if (updateLevel) {
            uint potentialLevel = levelHint;
            if (potentialLevel > 0) {
                userQualificationLevel[headOfLocation] = potentialLevel;
                emit QualificationUpdated(headOfLocation, 0, potentialLevel, 0);
            }
        }
        userQualificationOrigin[headOfLocation] = 1;
    }

    function _importRegionalManagerTurnover(address regionalManager, uint turnover, uint levelHint, bool addToCurrentTurnover, bool updateLevel) private {
        require(isRegionManager[regionalManager], "User is not HOL");
        require(levelHint < qualificationsCount, "Incorrect level hint");

        uint actualTurnover;
        if (addToCurrentTurnover) {
            uint previousTurnover = regionalManagerTurnover[regionalManager];

            actualTurnover = previousTurnover + turnover;
            emit ImportRegionalManagerTurnoverUpdate(regionalManager, previousTurnover, actualTurnover);
            regionalManagerTurnover[regionalManager] = actualTurnover;
        } else {
            regionalManagerTurnover[regionalManager] = turnover;
            emit ImportRegionalManagerTurnoverSet(regionalManager, turnover);
            actualTurnover = turnover;
        }

        if (updateLevel) {
            uint potentialLevel = levelHint;
            if (potentialLevel > 0) {
                userQualificationLevel[regionalManager] = potentialLevel;
                emit QualificationUpdated(regionalManager, 0, potentialLevel, 0);
            }
        }
        userQualificationOrigin[regionalManager] = 1;
    }

    function _importUserMaxLevelPayment(address user, uint maxLevelPayment, bool addToCurrentPayment) internal {
        require(userQualificationLevel[user] >= qualificationsCount - 1, "Not max level user");
        if (addToCurrentPayment) {
            userMaxLevelPayment[user] += maxLevelPayment;
        } else {
            userMaxLevelPayment[user] = maxLevelPayment;
        }
        emit ImportUserMaxLevelPayment(user, maxLevelPayment, addToCurrentPayment);
    }

    function updateNFTSmartStakerContract(address nftSmartStakerAddress) external onlyOwner {
        require(AddressUpgradeable.isContract(nftSmartStakerAddress), "NFTSmartStakerContractAddress is not a contract");
        nftSmartStaker = IStakingMain(nftSmartStakerAddress);
        emit UpdateNFTSmartStakerContract(nftSmartStakerAddress);
    }

    //Admin functions
    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Can't be zero address");
        require(amount > 0, "Should be greater than 0");
        TransferHelper.safeTransferBNB(to, amount);
        emit Rescue(to, amount);
    }

    function rescue(address to, address token, uint256 amount) external onlyOwner {
        require(to != address(0), "Can't be zero address");
        require(amount > 0, "Should be greater than 0");
        TransferHelper.safeTransfer(token, to, amount);
        emit RescueToken(token, to, amount);
    }
}