pragma solidity >=0.5.0 <0.6.0;


interface IWbnb {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
