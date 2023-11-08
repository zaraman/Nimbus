// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStakingMain {
    function WBNB() external view returns(address);
}

interface IStakingSet {
    function buyStakingSet(uint256 amount, uint256 tokenId) external;
    function withdrawUserRewards(uint256 id, address tokenOwner) external;
    function burnStakingSet(uint256 id, address tokenOwner) external;
    function getNFTfields(uint tokenId, uint NFTFieldIndex) 
        external 
        view 
        returns (address pool, address rewardToken, uint256 rewardAmount, uint256 percentage, uint256 stakedAmount);
    function purchaseToken() external view returns(address); 
}

contract HubRouting is Ownable {
    address immutable StakingMain;
    uint256 public stakingSetCount;

    mapping(uint256 => bool) public listActive;
    mapping(uint256 => address) public listMap; // stakingSet id => address
    mapping(uint256 => address) public smartByNFT; // nft id => stakingSet address

    event UpdateStakingSetStatus(uint256 indexed setNum, bool isActive);
    event RegistrationSet(uint256 indexed stakingSetCount, address stakingSet, address purchaseToken);

    constructor(address _StakingMain) {
        require(_StakingMain != address(0), "HubRouting :: Zero address was given as StakingMain");
        StakingMain = _StakingMain;
    }

    modifier onlyStakingMain {
        require(msg.sender == StakingMain, "HubRouting::caller is not the Staking Main contract");
        _;
    }

    function stake(uint256 _setNum, uint256 _amount, uint _tokenId) external payable onlyStakingMain {
        require(listActive[_setNum], "StakingSet::not active");
        smartByNFT[_tokenId] = listMap[_setNum];
        (bool success,) = listMap[_setNum].call{value: msg.value}(abi.encodeWithSignature("buyStakingSet(uint256,uint256)",_amount,_tokenId));
        require(success, "HubRouting::buySmartStaker failed");
    }


    function withdrawReward(uint256 _id, address _tokenOwner) external onlyStakingMain {
        address stakingSet = smartByNFT[_id];
        IStakingSet(stakingSet).withdrawUserRewards(_id, _tokenOwner);
    }

    function burn(uint256 _id, address _tokenOwner) external onlyStakingMain {
        address stakingSet = smartByNFT[_id];
        IStakingSet(stakingSet).burnStakingSet(_id, _tokenOwner);
    }

    
    function getNFTFields(uint256 _id, uint256 NFTFieldIndex) 
        external 
        view 
        returns (address pool, address rewardToken, uint256 rewardAmount, uint256 percentage, uint256 stakedAmount) 
    {
        (pool, rewardToken, rewardAmount, percentage, stakedAmount) = IStakingSet(smartByNFT[_id]).getNFTfields(_id, NFTFieldIndex);
    }

    function registrationSet(address _stakingSet) external onlyStakingMain {
        listMap[stakingSetCount] = _stakingSet;
        listActive[stakingSetCount] = true;
        stakingSetCount++;
        address purchaseToken = IStakingSet(_stakingSet).purchaseToken();

        emit RegistrationSet(stakingSetCount, _stakingSet, purchaseToken);
    }

    function deactivateSet(uint256 _setNum) external onlyOwner {
        listActive[_setNum] = false;

        emit UpdateStakingSetStatus(_setNum, false);
    }

    function activateSet(uint256 _setNum) external onlyOwner {
        listActive[_setNum] = true;

        emit UpdateStakingSetStatus(_setNum, true);
    }
}
