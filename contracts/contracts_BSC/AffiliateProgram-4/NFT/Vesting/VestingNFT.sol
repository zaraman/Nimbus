pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract VestingNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable, ERC721Burnable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping (uint256 => uint256) public supplyTime; // tokenId -> supplyTime
    uint256 public lockTime = 365 days;
    address public affiliateContract;
    uint256 public lastTokenId;
    
    struct Denomination {
        address token;
        uint256 value;
    }

    mapping (uint256 => Denomination) public denominations;

    constructor() ERC721("VestingNFT", "VNFT") {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(address to, string memory uri, uint256 _nominal, address _token) public {
        lastTokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, lastTokenId);
        _setTokenURI(lastTokenId, uri);
        supplyTime[lastTokenId] = block.timestamp;
        denominations[lastTokenId].token = _token;
        denominations[lastTokenId].value = _nominal;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        if (to == address(0)) {
            require(block.timestamp > supplyTime[tokenId] + lockTime, "Vesting NFT::Token is locked");
        }

        if (from == address(0)) {
            require(msg.sender == affiliateContract, "Vesting NFT::Is not allowed to mint NFT");
        }
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // owner functions

    function setLockTime(uint256 _lockTime) external onlyOwner {
        lockTime = _lockTime;
    }

    function setAffiliateContract(address _affiliateContract) external onlyOwner {
        affiliateContract = _affiliateContract;
    }
}