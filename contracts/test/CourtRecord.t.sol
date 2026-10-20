// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CourtRecord} from "../src/CourtRecord.sol";
import {ReceiverTemplate} from "../src/ReceiverTemplate.sol";

contract CourtRecordTest is Test {
  CourtRecord internal court;
  address internal forwarder = makeAddr("forwarder");
  bytes32 internal constant ETH = bytes32("ETH");
  bytes32 internal constant BTC = bytes32("BTC");

  function setUp() public {
    court = new CourtRecord(forwarder);
  }

  function _report(
    bytes32 asset,
    uint8 verdict,
    uint16 sizeBps,
    uint64 entry,
    uint64 stop,
    uint64 target,
    bytes32 transcript
  ) internal pure returns (bytes memory) {
    return abi.encode(
      asset, verdict, uint8(70), sizeBps, entry, stop, target, uint64(1_760_000_000), transcript, keccak256("ev"), "So ordered."
    );
  }

  function _file(bytes memory report) internal {
    vm.prank(forwarder);
    court.onReport("", report);
  }

  function test_RejectsNonForwarder() public {
    bytes memory r = _report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t1"));
    vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, address(this), forwarder));
    court.onReport("", r);
  }

  function test_EntersRuling() public {
    _file(_report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t1")));
    assertEq(court.totalCases(), 1);
    CourtRecord.Ruling memory r = court.getRuling(0);
    assertEq(uint8(r.verdict), 1);
    assertEq(r.sizeBps, 1000);
    assertEq(r.holding, "So ordered.");
    assertFalse(r.settled);
    (bool open, uint256 n) = court.openCaseFor(ETH);
    assertTrue(open);
    assertEq(n, 0);
  }

  function test_RejectsDuplicateTranscript() public {
    _file(_report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t1")));
    vm.prank(forwarder);
    vm.expectRevert(abi.encodeWithSelector(CourtRecord.DuplicateTranscript.selector, keccak256("t1")));
    court.onReport("", _report(ETH, 2, 1000, 3000e8, 3100e8, 2800e8, keccak256("t1")));
  }

  function test_SettlesLongAtMark() public {
    _file(_report(ETH, 1, 2000, 3000e8, 2900e8, 3300e8, keccak256("t1")));
    // next trial marks ETH at 3150 → +5% move, 20% size → +1% bankroll
    _file(_report(ETH, 0, 0, 3150e8, 0, 0, keccak256("t2")));
    CourtRecord.Ruling memory r = court.getRuling(0);
    assertTrue(r.settled);
    assertEq(r.exitPrice, 3150e8);
    assertEq(r.moveBps, 500);
    assertEq(r.bankrollImpactBps, 100);
    assertEq(court.equityIndex(), 1.01e8);
    assertEq(court.wins(), 1);
    (bool open,) = court.openCaseFor(ETH);
    assertFalse(open, "dismissal opens nothing");
  }

  function test_StopIsHonoredOnShort() public {
    _file(_report(BTC, 2, 5000, 60_000e8, 63_000e8, 54_000e8, keccak256("t1")));
    // price gaps to 70k, past the 63k stop → exit at stop: -5% move, 50% size → -2.5% bankroll
    _file(_report(BTC, 1, 1000, 70_000e8, 68_000e8, 74_000e8, keccak256("t2")));
    CourtRecord.Ruling memory r = court.getRuling(0);
    assertEq(r.exitPrice, 63_000e8);
    assertEq(r.moveBps, -500);
    assertEq(r.bankrollImpactBps, -250);
    assertEq(court.equityIndex(), 0.975e8);
    assertEq(court.losses(), 1);
    (bool open, uint256 n) = court.openCaseFor(BTC);
    assertTrue(open);
    assertEq(n, 1);
  }

  function test_RecentRulingsNewestFirst() public {
    _file(_report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t1")));
    _file(_report(BTC, 2, 1000, 60_000e8, 62_000e8, 56_000e8, keccak256("t2")));
    _file(_report(ETH, 0, 0, 3010e8, 0, 0, keccak256("t3")));
    CourtRecord.Ruling[] memory page = court.getRecentRulings(0, 2);
    assertEq(page.length, 2);
    assertEq(page[0].transcriptHash, keccak256("t3"));
    assertEq(page[1].transcriptHash, keccak256("t2"));
  }

  function test_WorkflowIdentityChecks() public {
    bytes32 wfId = keccak256("workflow");
    address author = makeAddr("author");
    court.setExpectedWorkflowId(wfId);
    court.setExpectedAuthor(author);

    bytes memory metadata = abi.encodePacked(wfId, bytes10("bullvbear0"), author);
    vm.prank(forwarder);
    court.onReport(metadata, _report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t1")));
    assertEq(court.totalCases(), 1);

    bytes memory badMeta = abi.encodePacked(wfId, bytes10("bullvbear0"), makeAddr("mallory"));
    vm.prank(forwarder);
    vm.expectRevert();
    court.onReport(badMeta, _report(ETH, 1, 1000, 3000e8, 2900e8, 3200e8, keccak256("t2")));
  }
}
