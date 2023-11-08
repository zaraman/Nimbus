// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface INimbusRouter {
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface IPriceFeed {
    function queryRate(address sourceTokenAddress, address destTokenAddress)
        external
        view
        returns (uint256 rate, uint256 precision);
}

contract PriceFeedSwapModifier is INimbusRouter, Ownable {
    uint256 internal constant WEI_PRECISION = 10**18;
    INimbusRouter public immutable swapRouter;
    IPriceFeed public immutable priceFeed;
    IERC20Metadata public baseToken;

    mapping(address => bool) public usePriceFeedForToken;
    mapping(address => mapping(address => bool)) public useBNBSwapForTokens;
    mapping(address => address) private tokenAlias;

    constructor(
        address _swapRouter,
        address _priceFeed,
        address _baseToken
    ) {
        require(
            Address.isContract(_swapRouter),
            "Swap router should be a contract"
        );
        require(
            Address.isContract(_priceFeed),
            "PriceFeed should be a contract"
        );
        require(
            Address.isContract(_baseToken),
            "Base token should be a contract"
        );
        swapRouter = INimbusRouter(_swapRouter);
        priceFeed = IPriceFeed(_priceFeed);
        baseToken = IERC20Metadata(_baseToken);
    }

    function setTokenAlias(address _token, address _alias) external onlyOwner {
        require(
            Address.isContract(_token) && Address.isContract(_alias),
            "Token and alias should be a contract"
        );
        tokenAlias[_token] = _alias;
    }

    function setBaseToken(address _baseToken) external onlyOwner {
        require(
            Address.isContract(_baseToken),
            "Base token should be a contract"
        );
        baseToken = IERC20Metadata(_baseToken);
    }

    function setUseBNBSwapForTokens(
        address _tokenA,
        address _tokenB,
        bool _usePriceFeedBNB
    ) external onlyOwner {
        require(Address.isContract(_tokenA), "Token should be a contract");
        require(Address.isContract(_tokenB), "Token should be a contract");
        useBNBSwapForTokens[_tokenA][_tokenB] = _usePriceFeedBNB;
        useBNBSwapForTokens[_tokenB][_tokenA] = _usePriceFeedBNB;
    }

    function setUsePriceFeedForToken(address _token, bool _usePriceFeed)
        external
        onlyOwner
    {
        require(Address.isContract(_token), "Token should be a contract");
        usePriceFeedForToken[_token] = _usePriceFeed;
    }

    function getAmountsOut(uint256 amountIn, address[] memory path)
        public
        view
        override
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = rateConversion(amountIn, path[0], path[1], true);
    }

    function getAmountsIn(uint256 amountOut, address[] memory path)
        public
        view
        override
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = rateConversion(amountOut, path[0], path[1], false);
        amounts[1] = amountOut;
    }

    function rateConversion(
        uint256 amount,
        address sourceTokenAddress,
        address destTokenAddress,
        bool isOut
    ) public view returns (uint256 result) {
        if (amount == 0) return 0;
        sourceTokenAddress = replaceToken(sourceTokenAddress);
        destTokenAddress = replaceToken(destTokenAddress);
        if (useBNBSwapForTokens[sourceTokenAddress][destTokenAddress]) {
            result = _swapResult(
                amount,
                sourceTokenAddress,
                address(baseToken),
                isOut
            );
            result = _swapResult(
                result,
                address(baseToken),
                destTokenAddress,
                isOut
            );
            return result;
        }
        if (
            !usePriceFeedForToken[sourceTokenAddress] &&
            !usePriceFeedForToken[destTokenAddress]
        ) {
            // ex. BNB-NIMB(NBU)(sw)
            result = _swapResult(
                amount,
                sourceTokenAddress,
                destTokenAddress,
                isOut
            );
            return result;
        } else if (
            usePriceFeedForToken[sourceTokenAddress] &&
            usePriceFeedForToken[destTokenAddress]
        ) {
            result = _priceFeedResult(
                amount,
                sourceTokenAddress,
                destTokenAddress,
                isOut
            );
            return result;
        }
        if (
            usePriceFeedForToken[sourceTokenAddress] &&
            !usePriceFeedForToken[destTokenAddress]
        ) {
            // ex. BUSD-NIMB(NBU) -> BUSD-BNB(pf)/BNB-NBU(sw)
            uint256 sourceToBaseAmount = _priceFeedResult(
                amount,
                sourceTokenAddress,
                address(baseToken),
                isOut
            );
            result = _swapResult(
                sourceToBaseAmount,
                address(baseToken),
                destTokenAddress,
                isOut
            );
            return result;
        }
        if (
            !usePriceFeedForToken[sourceTokenAddress] &&
            usePriceFeedForToken[destTokenAddress]
        ) {
            // ex. NIMB(NBU)-BUSD -> NBU-BNB(sw)/BNB-BUSD(pf)
            uint256 sourceToBaseAmount = _swapResult(
                amount,
                sourceTokenAddress,
                address(baseToken),
                isOut
            );
            result = _priceFeedResult(
                sourceToBaseAmount,
                address(baseToken),
                destTokenAddress,
                isOut
            );
            return result;
        }
    }

    function _swapResult(
        uint256 amount,
        address sourceTokenAddress,
        address destTokenAddress,
        bool isOut
    ) public view returns (uint256 result) {
        if (sourceTokenAddress == destTokenAddress) return amount;
        address[] memory path = new address[](2);
        path[0] = sourceTokenAddress;
        path[1] = destTokenAddress;
        result = isOut
            ? swapRouter.getAmountsOut(amount, path)[1]
            : swapRouter.getAmountsIn(amount, path)[0];
    }

    function _priceFeedResult(
        uint256 amount,
        address sourceTokenAddress,
        address destTokenAddress,
        bool isOut
    ) public view returns (uint256 result) {
        if (sourceTokenAddress == destTokenAddress) return amount;
        (uint256 rate, uint256 precision) = priceFeed.queryRate(
            sourceTokenAddress,
            destTokenAddress
        );
        result = isOut
            ? (amount * rate) / precision
            : (amount * precision) / rate;
    }

    function replaceToken(address token) public view returns (address) {
        return tokenAlias[token] != address(0) ? tokenAlias[token] : token;
    }
}
