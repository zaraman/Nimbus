pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";

contract ApprovalContract is State {
    function initialize(
        address target)
        external
        onlyOwner
    {
        _setTarget(this.approveProtocolForToken.selector, target);
    }

    function approveProtocolForToken(address token, address router, uint amount) external onlyOwner {
        IBEP20(token).approve(router, amount);
    }
}