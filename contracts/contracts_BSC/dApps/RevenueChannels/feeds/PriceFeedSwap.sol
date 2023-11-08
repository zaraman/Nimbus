// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IPriceFeedsExt {
    function latestAnswer() external view returns (uint256);
}

interface INimbusRouter {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract PriceFeedSwap is IPriceFeedsExt, Ownable {
    INimbusRouter immutable public swapRouter;
    address[] public swapPath;

    uint8 immutable public decimals;
    uint256 public multiplier;

    uint256 constant MULTIPLIER_DEFAULT = 10000;

    event SetMultiplier(uint256 oldMultiplier, uint256 newMultiplier);

    constructor(address _swapRouter, address[] memory _swapPath) {
        require(Address.isContract(_swapRouter), "Swap router should be a contract");
        swapRouter = INimbusRouter(_swapRouter);
        require(_swapPath.length > 1, "Swap path should consists of more then 2 contracts");
        for (uint8 i = 0; i < _swapPath.length; i++) {
            require(Address.isContract(_swapPath[i]), "Swap path should consists of contracts");
            swapPath.push(_swapPath[i]);
        }
        decimals = IERC20Metadata(_swapPath[_swapPath.length-1]).decimals();
        multiplier = MULTIPLIER_DEFAULT;
    }
    
    /**
     * @notice Sets price multiplier
     * @param newMultiplier new multiplier
     * @dev This method sets new price multiplier, with base multiplier is 10000
     * For example, for 3% change set multiplier to 10300
     * Can be executed only by owner.
     */
    function setMultiplier(uint256 newMultiplier) external onlyOwner {
        emit SetMultiplier(multiplier, newMultiplier);
        multiplier = newMultiplier;
    }
    
    /**
     * @notice Returns last price update timestamp
     * @dev This method returns last price update timestamp
     */
    function lastUpdateTimestamp() external view returns (uint256) {
        return block.timestamp;
    } 
    
    /**
     * @notice Returns rate
     * @dev This method returns rate with applied multiplier
     */
    function latestAnswer() external override view returns (uint256) {
        return swapRouter.getAmountsOut(10 ** decimals, swapPath)[swapPath.length - 1] * multiplier / MULTIPLIER_DEFAULT;
    }
}
