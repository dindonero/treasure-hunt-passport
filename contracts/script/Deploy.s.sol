// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TreasureHuntRewards} from "../src/TreasureHuntRewards.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address signerAddress = vm.envAddress("SIGNER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        string memory tokenName = vm.envOr("TOKEN_NAME", string("Bootcamp Coin"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("BC"));

        TreasureHuntRewards token = new TreasureHuntRewards(tokenName, tokenSymbol);
        console.log("TreasureHuntRewards deployed at:", address(token));

        // Set the signer address (for signature verification)
        if (signerAddress != address(0)) {
            token.setSigner(signerAddress);
            console.log("Signer set to:", signerAddress);
        }

        vm.stopBroadcast();
    }
}
