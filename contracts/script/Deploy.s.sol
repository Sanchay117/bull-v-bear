// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CourtRecord} from "../src/CourtRecord.sol";

/// @notice Deploys CourtRecord.
///   FORWARDER — the Keystone forwarder allowed to file rulings. For `cre workflow simulate --broadcast`
///               on Sepolia use the MockKeystoneForwarder listed by `cre workflow supported-chains`.
contract Deploy is Script {
  function run() external returns (CourtRecord court) {
    address forwarder = vm.envAddress("FORWARDER");
    vm.startBroadcast();
    court = new CourtRecord(forwarder);
    vm.stopBroadcast();
    console2.log("CourtRecord deployed at", address(court));
    console2.log("Forwarder", forwarder);
  }
}
