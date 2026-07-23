// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// ERC-4337 v0.6 UserOperation struct
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint {
    function getNonce(address sender, uint192 key) external view returns (uint256);
}

interface IAccount {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

contract Account is IAccount, Initializable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public owner;

    IEntryPoint private constant ENTRY_POINT =
        IEntryPoint(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);

    modifier onlyEntryPointOrOwner() {
        require(
            msg.sender == address(ENTRY_POINT) || msg.sender == owner,
            "Account: not authorized"
        );
        _;
    }

    function initialize(address _owner) external initializer {
        require(_owner != address(0), "Account: zero owner");
        owner = _owner;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        require(msg.sender == address(ENTRY_POINT), "Account: not from EntryPoint");

        bytes32 ethHash = userOpHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(userOp.signature);

        validationData = (recovered == owner) ? 0 : 1;

        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            (success); // ignore failure (EntryPoint will revert if needed)
        }
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata data
    ) external onlyEntryPointOrOwner {
        (bool success, bytes memory result) = dest.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function entryPoint() external pure returns (IEntryPoint) {
        return ENTRY_POINT;
    }

    receive() external payable {}
}
