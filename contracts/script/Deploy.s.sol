// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CourtRecord} from "../src/CourtRecord.sol";

/// @notice Deploys CourtRecord.
///   FORWARDER — the Keystone forwarder allowed to file rulings. On Sepolia:
///     simulation (`cre workflow simulate --broadcast`): MockKeystoneForwarder 0x15fC6ae953E024d975e77382eEeC56A9101f9F88
///     deployed workflows:                                KeystoneForwarder     0xF8344CFd5c43616a4366C34E3EEE75af79a74482
///   The owner can switch later with setForwarderAddress().
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
