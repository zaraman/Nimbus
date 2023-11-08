// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


interface IBEP721 {
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

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface IBEP721Metadata is IBEP721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

interface IBEP20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}

interface IStakingSet {
    function purchaseToken() external view returns(address); 
    function POOLS_NUMBER() external view returns(uint256);
    function providedAmount(uint256) external view returns(uint256);
    function minPurchaseAmount() external view returns(uint256);
    function lockTime() external view returns(uint256);
    function getNFTtiming(uint256) external view returns(uint256,uint256);
    function counter() external view returns(uint256);
}

interface IHubRouting {
    function stake(uint256 _setNum, uint256 _amount, uint _tokenCount) external;
    function withdrawReward(uint256 _id, address _tokenOwner) external;
    function burn(uint256 _id, address _tokenOwner) external;
    function registrationSet(address _stakingSet) external; 
    function smartByNFT(uint256 _id) external view returns(address);
    function listMap(uint256 _setNum) external view returns(address);
    function getNFTfields(uint tokenId, uint NFTFieldIndex) 
        external 
        view 
        returns (address pool, address rewardToken, uint256 rewardAmount, uint256 percentage, uint256 stakedAmount);
    function deactivateSet(uint256 _setNum) external;
    function activateSet(uint256 _setNum) external;
}


contract StakingMain is IBEP721, IBEP721Metadata, Ownable {
    using SafeERC20 for IBEP20;
    using Address for address;
    IHubRouting public Hub;
    uint256 public tokenCount;
    address immutable WBNB;

    string internal _name;
    string internal _symbol;
    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(address => uint[]) internal _userTokens;

    struct NFTFields {
	  address pool;
	  address rewardToken;
	  uint256 rewardAmount;
	  uint256 percentage;
      uint256 stakedAmount;
    }

    event Rescue(address indexed to, uint amount);
    event RescueToken(address indexed to, address indexed token, uint amount);

    constructor(address _WBNB) {
        _name = "Smart Staker";
        _symbol = "SMART";
        require(Address.isContract(_WBNB), "StakingMain: Not a contract");
        WBNB = _WBNB;
    }

    function setHubRouting(address _hub) external onlyOwner {
        require(Address.isContract(_hub), "StakingMain: Not a contract");
        Hub = IHubRouting(_hub);
    }
     
    function buySmartStaker(uint256 _setNum, uint _amount) external payable {
        address stakingSet = Hub.listMap(_setNum);
        address purchaseToken = IStakingSet(stakingSet).purchaseToken();
        tokenCount++;
        _userTokens[msg.sender].push(tokenCount); 
        _mint(msg.sender, tokenCount);
        if (WBNB != purchaseToken) {
            require(IBEP20(purchaseToken).transferFrom(msg.sender, stakingSet, _amount), "IBEP20: TRANSFER_FROM_FAILED");
        }
        Address.functionCallWithValue(address(Hub), abi.encodeWithSignature("stake(uint256,uint256,uint256)",_setNum,_amount,tokenCount), msg.value, "StakingMain::buySmartStaker failed");
    }

    function withdrawReward(uint256 _id) external {
        require(ownerOf(_id) == msg.sender, "StakingMain: Not token owner");        
        Hub.withdrawReward(_id, msg.sender); // rewards to msg.sender
    }

    function burnSmartStaker(uint256 _id) external {
        require(ownerOf(_id) == msg.sender, "StakingMain: Not token owner");
        _burn(_id);
        Hub.burn(_id, msg.sender); // rewards to msg.sender
    }

    function addSet(address _stakingSet) external onlyOwner {
        Hub.registrationSet(_stakingSet);
    }

    function getNFTFields(uint256 _id) external view returns (NFTFields[] memory) {
        uint256 POOLS_NUMBER = IStakingSet(Hub.smartByNFT(_id)).POOLS_NUMBER();
        NFTFields[] memory nftFields = new NFTFields[](POOLS_NUMBER);

        for (uint8 i = 0; i < POOLS_NUMBER; i++) {
            (nftFields[i].pool, nftFields[i].rewardToken, nftFields[i].rewardAmount, nftFields[i].percentage, nftFields[i].stakedAmount) = IHubRouting(Hub.smartByNFT(_id)).getNFTfields(_id, i);
        }

        return nftFields;
    }

    function getStakingSetInfo(uint _setNum) 
        external 
        view 
        returns(address purchaseToken, uint256 minPurchaseAmount, uint256 lockTime, uint256 counter) 
    {
        IStakingSet StakingSet = IStakingSet(Hub.listMap(_setNum));
        purchaseToken = StakingSet.purchaseToken();
        minPurchaseAmount = StakingSet.minPurchaseAmount();
        lockTime = StakingSet.lockTime();
        counter = StakingSet.counter();
    }

    function getProvidedAmount(uint _id) 
        external 
        view 
        returns(address purchaseToken,uint256 providedAmount, uint256 supplyTime, uint256 burnTime) 
    {
        IStakingSet StakingSet = IStakingSet(Hub.smartByNFT(_id));
        purchaseToken = StakingSet.purchaseToken();
        providedAmount = StakingSet.providedAmount(_id);
        (supplyTime, burnTime) = StakingSet.getNFTtiming(_id);
    }

    function getUserTokens(address user) external view returns (uint[] memory) {
        return _userTokens[user];
    }


    // ========================== EIP 721 functions ==========================


    function balanceOf(address owner) external view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    function name() external view virtual override returns (string memory) {
        return _name;
    }

    function symbol() external view virtual override returns (string memory) {
        return _symbol;
    }


    function approve(address to, uint256 tokenId) external virtual override {
        address owner = StakingMain.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external virtual override {
        _setApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) external virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public virtual override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    
    
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = StakingMain.ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    function _safeMint(address to, uint256 tokenId, bytes memory _data) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = StakingMain.ownerOf(tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _removeTokenFromUser(tokenId, owner);

        _balances[owner] -= 1;
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function _removeTokenFromUser(uint256 tokenId, address owner) internal {
        for (uint256 i; i < _userTokens[owner].length; i++) {
            if(_userTokens[owner][i] == tokenId) {
                _remove(i, owner);
                break;
            }
        }
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: transfer to the zero address");
        require(StakingMain.ownerOf(tokenId) == from, "ERC721: transfer of token that is not owner");

        _removeTokenFromUser(tokenId, owner());

        // Clear approvals from the previous owner
        _approve(address(0), tokenId);
        _userTokens[to].push(tokenId);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _remove(uint index, address tokenOwner) internal virtual {
        _userTokens[tokenOwner][index] = _userTokens[tokenOwner][_userTokens[tokenOwner].length - 1];
        _userTokens[tokenOwner].pop();
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(StakingMain.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll( address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _checkOnERC721Received(address from, address to,uint256 tokenId, bytes memory _data) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }



    // ========================== Owner functions ==========================


    function rescue(address to, address tokenAddress, uint256 amount) external onlyOwner {
        require(to != address(0), "StakingMain: Cannot rescue to the zero address");
        require(amount > 0, "StakingMain: Cannot rescue 0");

        require(IBEP20(tokenAddress).transfer(to, amount), "IBEP20: TRANSFER_FAILED");
        emit RescueToken(to, address(tokenAddress), amount);
    }

    function rescue(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "StakingMain: Cannot rescue to the zero address");
        require(amount > 0, "StakingMain: Cannot rescue 0");

        to.transfer(amount);
        emit Rescue(to, amount);
    }
}
