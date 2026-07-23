// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Account.sol";

contract AccountFactory {
    address public immutable implementation;

    IEntryPoint private constant ENTRY_POINT =
        IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);

    constructor(address _implementation) {
        require(_implementation != address(0), "AccountFactory: zero impl");
        implementation = _implementation;
    }

    function createAccount(
        address owner,
        bytes calldata data
    ) external returns (address) {
        bytes32 salt = keccak256(abi.encode(owner, data));
        address predicted = getAddress(owner, data);

        if (predicted.code.length > 0) {
            return predicted;
        }

        bytes memory initData = abi.encodeWithSelector(
            Account.initialize.selector,
            owner
        );

        ERC1967Proxy proxy = new ERC1967Proxy{salt: salt}(
            implementation,
            initData
        );

        return address(proxy);
    }

    function getAddress(
        address owner,
        bytes calldata data
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(owner, data));

        bytes memory initData = abi.encodeWithSelector(
            Account.initialize.selector,
            owner
        );

        bytes memory proxyBytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(implementation, initData)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(proxyBytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    function entryPoint() external pure returns (IEntryPoint) {
        return ENTRY_POINT;
    }
}
