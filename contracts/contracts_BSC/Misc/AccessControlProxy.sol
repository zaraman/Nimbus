// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed from, address indexed to);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner {
        require(msg.sender == owner, "Ownable: Caller is not the owner");
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function getOwner() external view returns (address) {
        return owner;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address transferOwner) external onlyOwner {
        require(transferOwner != newOwner);
        newOwner = transferOwner;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function acceptOwnership() virtual external {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

/// @title Access Control Proxy
/// @notice Used for additional access control functionality for owner's methods of Ownable contracts
/// @dev Implements proxy-like structure to filter owner's methods calls on other smart contracts
contract AccessControlProxy is Ownable {
    using SafeERC20 for IERC20;

    address public target;
    mapping (address => mapping (bytes4 => bool)) public allowedSignatures;

    event SetTarget(address indexed newTarget);
    event UpdateAllowedSignature(address indexed account, bytes4 indexed sig, string methodDefinition, bool isAllowed);
    event RescueToken(address indexed to, address indexed token, uint256 amount);
    
    /// @dev Initialize with target contract
    /// @param _newTarget Address of new target contract
    constructor(address _newTarget) {
        _setTarget(_newTarget);
    }

    /// @dev Check if caller is owner or allowed to use method with modifier
    modifier ownerOrAllowed {
        require(msg.sender == owner || allowedSignatures[msg.sender][msg.sig], "Caller not allowed to call this method");
        _;
    }

    /// @dev Check if target contract has valid owner
    modifier targetOwnerBinded {
        require(isTargetOwnerBinded(), "Target contract has wrong owner");
        _;
    }

    /// @notice Main access control proxy method
    /// @dev Proxy all calls that passed {ownerOrAllowed} modifier to target contract
    fallback() external payable targetOwnerBinded ownerOrAllowed {
        if (gasleft() <= 2300) {
            return;
        }

        address target_ = target;
        bytes memory data = msg.data;
        uint value = msg.value;
        assembly {
            let result := call(gas(), target_, value, add(data, 0x20), mload(data), 0, 0)
            let size := returndatasize()
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }

    receive() external payable {
        revert('Method signature is not defined');
    }

    /// @dev Change target Ownable contract, can be called by this contract owner
    /// @param _newTarget Address of new target contract
    function setTarget(address _newTarget) external onlyOwner {
        _setTarget(_newTarget);
    }

    /// @dev Sets target Ownable contract, with checks for Ownable interface and contract
    /// @param _newTarget Address of new target contract
    function _setTarget(address _newTarget) internal {
        require(Address.isContract(_newTarget), "Target not a contract");
        require(target == address(0) || !isTargetOwnerBinded(), "Can not switch with owner binded target");
        target = _newTarget;
        emit SetTarget(_newTarget);
    }

    /// @dev Call {acceptOwnership} method on target contract to set this contract as owner, can be called by this contract owner
    function acceptOwnerForTarget() external onlyOwner {
        Ownable(target).acceptOwnership();
    }

    /// @dev Call {transferOwnership} method on target contract to transfer owner of target contract, can be called by this contract owner
    /// @param newOwner Address of new owner of target contract
    function transferOwnerForTarget(address newOwner) external onlyOwner {
        Ownable(target).transferOwnership(newOwner);
    }

    /// @dev Check if target contract has owner value with this contract address
    /// @return bool is target contract has valid owner
    function isTargetOwnerBinded() public view returns(bool) {
        return address(Ownable(target).owner()) == address(this);
    }

    /// @dev Convert method definition to method signature that used in {msg.sig} verify
    /// @param methodDefinition Method name and params types eg. `balanceOf(address)`
    /// @return bytes4 4 bytes of method signature
    function getMethodSignature(string memory methodDefinition) public pure returns(bytes4) {
        return bytes4(keccak256(bytes(methodDefinition)));
    }

    /// @dev Update target contract methods access settings for multiple records at once, can be called by this contract owner
    /// @param accounts Array of accounts to update access
    /// @param methodDefinitions Array of Method name and params types eg. `balanceOf(address)` on target contract
    /// @param isAllowed Array of bool
    function updateAllowedMethods(address[] memory accounts, string[] memory methodDefinitions, bool[] memory isAllowed) external onlyOwner {
        require(accounts.length == methodDefinitions.length && accounts.length == isAllowed.length, "Array length missmatch");
        for(uint i = 0; i < accounts.length; i++) {
            _updateAllowedMethod(accounts[i], methodDefinitions[i], isAllowed[i]);
        }
    }

    /// @dev Update target contract methods access settings, can be called by this contract owner
    /// @param account Accounts to update access
    /// @param methodDefinition Method name and params types eg. `balanceOf(address)` on target contract
    /// @param isAllowed bool value if method is allowed to call
    function updateAllowedMethod(address account, string memory methodDefinition, bool isAllowed) external onlyOwner {
        _updateAllowedMethod(account, methodDefinition, isAllowed);
    }

    /// @dev Update target contract methods access settings
    /// @param account Accounts to update access
    /// @param methodDefinition Method name and params types eg. `balanceOf(address)` on target contract
    /// @param isAllowed bool value if method is allowed to call
    function _updateAllowedMethod(address account, string memory methodDefinition, bool isAllowed) internal {
        bytes4 sig = getMethodSignature(methodDefinition);
        allowedSignatures[account][sig] = isAllowed;
        emit UpdateAllowedSignature(account, sig, methodDefinition, isAllowed);
    }

    /**
     * @notice Rescues ERC20 tokens from Contract
     * @param to address to withdraw tokens
     * @param token address of ERC20 token
     * @param amount amount of ERC20 token
     * @dev This method rescues particular amount of ERC20 token from contract to given address.
     * Can be executed only by owner.
     */
    function rescueERC20(address to, IERC20 token, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot rescue to the zero address");
        require(amount > 0, "Cannot rescue 0");

        token.safeTransfer(to, amount);
        emit RescueToken(to, address(token), amount);
    }
}
