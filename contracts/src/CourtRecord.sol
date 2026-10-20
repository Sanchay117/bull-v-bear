// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";

/// @title CourtRecord — the public docket of the Court of Market Opinion
/// @notice Every trial of "Bull v. Bear" is decided off-chain by AI counsel and an AI judge inside a
///         Chainlink CRE workflow. The DON then files the ruling here through the Keystone forwarder.
///         Each ruling carries a keccak256 hash of the full canonical transcript (exhibits, arguments,
///         opinion, sentencing math) so anyone can verify the published reasoning was never altered.
///
///         Positions are PRACTICE positions only: no funds move. When a new ruling arrives for the same
///         asset, the previous open position is settled at the new mark price (protective orders —
///         stop and target — are assumed honored), and the court's practice equity index is updated.
contract CourtRecord is ReceiverTemplate {
  enum Verdict {
    DISMISSED,
    LONG,
    SHORT
  }

  struct Ruling {
    bytes32 asset;
    Verdict verdict;
    uint8 conviction; // 0-100
    uint16 sizeBps; // practice position as bps of the practice bankroll
    uint64 entryPrice; // USD, 8 decimals (also the mark used to settle the prior position)
    uint64 stopPrice;
    uint64 targetPrice;
    uint64 trialTime; // unix seconds, from the workflow
    uint64 filedAt; // block timestamp
    bytes32 transcriptHash; // keccak256 of the canonical transcript JSON
    bytes32 evidenceHash; // keccak256 of the canonical exhibits JSON
    bool settled;
    uint64 exitPrice;
    int32 moveBps; // price move in the position's favor, bps
    int32 bankrollImpactBps; // moveBps * sizeBps / 10_000
    string holding; // one-sentence holding of the court
  }

  uint256 public constant EQUITY_SCALE = 1e8;

  Ruling[] private s_rulings;
  mapping(bytes32 asset => uint256 caseNumberPlusOne) private s_openCase;
  mapping(bytes32 transcriptHash => uint256 caseNumberPlusOne) private s_byTranscript;

  /// @notice Practice equity index, starts at 1e8 (= 100%).
  uint256 public equityIndex = EQUITY_SCALE;
  uint256 public wins;
  uint256 public losses;

  error DuplicateTranscript(bytes32 transcriptHash);
  error InvalidPrice();
  error InvalidVerdict(uint8 verdict);
  error NoSuchCase(uint256 caseNumber);

  event RulingEntered(
    uint256 indexed caseNumber,
    bytes32 indexed asset,
    Verdict verdict,
    uint8 conviction,
    uint16 sizeBps,
    uint64 entryPrice,
    bytes32 transcriptHash,
    string holding
  );

  event PositionSettled(
    uint256 indexed caseNumber,
    bytes32 indexed asset,
    uint64 exitPrice,
    int32 moveBps,
    int32 bankrollImpactBps,
    uint256 equityIndex
  );

  constructor(address forwarder) ReceiverTemplate(forwarder) {}

  /// @dev report = abi.encode(bytes32 asset, uint8 verdict, uint8 conviction, uint16 sizeBps,
  ///      uint64 entryPrice, uint64 stopPrice, uint64 targetPrice, uint64 trialTime,
  ///      bytes32 transcriptHash, bytes32 evidenceHash, string holding)
  function _processReport(bytes calldata report) internal override {
    (
      bytes32 asset,
      uint8 verdict,
      uint8 conviction,
      uint16 sizeBps,
      uint64 entryPrice,
      uint64 stopPrice,
      uint64 targetPrice,
      uint64 trialTime,
      bytes32 transcriptHash,
      bytes32 evidenceHash,
      string memory holding
    ) = abi.decode(
        report, (bytes32, uint8, uint8, uint16, uint64, uint64, uint64, uint64, bytes32, bytes32, string)
      );

    if (verdict > uint8(Verdict.SHORT)) revert InvalidVerdict(verdict);
    if (entryPrice == 0) revert InvalidPrice();
    if (s_byTranscript[transcriptHash] != 0) revert DuplicateTranscript(transcriptHash);

    // Settle the asset's open practice position at this trial's mark price.
    uint256 open = s_openCase[asset];
    if (open != 0) {
      _settle(open - 1, entryPrice);
      delete s_openCase[asset];
    }

    uint256 caseNumber = s_rulings.length;
    Verdict v = Verdict(verdict);
    bool takesPosition = v != Verdict.DISMISSED && sizeBps > 0;

    s_rulings.push(
      Ruling({
        asset: asset,
        verdict: v,
        conviction: conviction > 100 ? 100 : conviction,
        sizeBps: takesPosition ? (sizeBps > 10_000 ? 10_000 : sizeBps) : 0,
        entryPrice: entryPrice,
        stopPrice: stopPrice,
        targetPrice: targetPrice,
        trialTime: trialTime,
        filedAt: uint64(block.timestamp),
        transcriptHash: transcriptHash,
        evidenceHash: evidenceHash,
        settled: !takesPosition,
        exitPrice: 0,
        moveBps: 0,
        bankrollImpactBps: 0,
        holding: holding
      })
    );
    s_byTranscript[transcriptHash] = caseNumber + 1;
    if (takesPosition) s_openCase[asset] = caseNumber + 1;

    emit RulingEntered(caseNumber, asset, v, conviction, sizeBps, entryPrice, transcriptHash, holding);
  }

  function _settle(uint256 caseNumber, uint64 mark) internal {
    Ruling storage r = s_rulings[caseNumber];
    uint64 exit = mark;
    int256 move;

    if (r.verdict == Verdict.LONG) {
      if (r.stopPrice != 0 && mark <= r.stopPrice) exit = r.stopPrice;
      else if (r.targetPrice != 0 && mark >= r.targetPrice) exit = r.targetPrice;
      move = ((int256(uint256(exit)) - int256(uint256(r.entryPrice))) * 10_000) / int256(uint256(r.entryPrice));
    } else {
      if (r.stopPrice != 0 && mark >= r.stopPrice) exit = r.stopPrice;
      else if (r.targetPrice != 0 && mark <= r.targetPrice) exit = r.targetPrice;
      move = ((int256(uint256(r.entryPrice)) - int256(uint256(exit))) * 10_000) / int256(uint256(r.entryPrice));
    }

    int256 impact = (move * int256(uint256(r.sizeBps))) / 10_000;
    if (impact < -9_999) impact = -9_999;

    equityIndex = (equityIndex * uint256(10_000 + impact)) / 10_000;
    if (move > 0) wins++;
    else if (move < 0) losses++;

    r.settled = true;
    r.exitPrice = exit;
    r.moveBps = int32(move);
    r.bankrollImpactBps = int32(impact);

    emit PositionSettled(caseNumber, r.asset, exit, int32(move), int32(impact), equityIndex);
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  function totalCases() external view returns (uint256) {
    return s_rulings.length;
  }

  function getRuling(uint256 caseNumber) external view returns (Ruling memory) {
    if (caseNumber >= s_rulings.length) revert NoSuchCase(caseNumber);
    return s_rulings[caseNumber];
  }

  /// @notice Returns up to `count` rulings, newest first, starting `offset` from the newest.
  function getRecentRulings(uint256 offset, uint256 count) external view returns (Ruling[] memory page) {
    uint256 total = s_rulings.length;
    if (offset >= total) return new Ruling[](0);
    uint256 n = total - offset < count ? total - offset : count;
    page = new Ruling[](n);
    for (uint256 i = 0; i < n; i++) {
      page[i] = s_rulings[total - 1 - offset - i];
    }
  }

  function openCaseFor(bytes32 asset) external view returns (bool exists, uint256 caseNumber) {
    uint256 v = s_openCase[asset];
    return (v != 0, v == 0 ? 0 : v - 1);
  }

  function caseForTranscript(bytes32 transcriptHash) external view returns (bool exists, uint256 caseNumber) {
    uint256 v = s_byTranscript[transcriptHash];
    return (v != 0, v == 0 ? 0 : v - 1);
  }
}
