// SPDX-License-Identifier: MIT
// Adapted from Chainlink's CRE ReceiverTemplate (https://docs.chain.link/cre), with the
// OpenZeppelin Ownable dependency replaced by a minimal inline owner.
pragma solidity ^0.8.24;

import {IERC165} from "./IERC165.sol";
import {IReceiver} from "./IReceiver.sol";

/// @title ReceiverTemplate
/// @notice Accepts CRE workflow reports only from the configured Keystone forwarder and,
///         optionally, only from one workflow owner / workflow id.
abstract contract ReceiverTemplate is IReceiver {
  address public owner;
  address private s_forwarder;
  address private s_expectedAuthor;
  bytes32 private s_expectedWorkflowId;

  error NotOwner();
  error InvalidForwarderAddress();
  error InvalidSender(address sender, address expected);
  error InvalidAuthor(address received, address expected);
  error InvalidWorkflowId(bytes32 received, bytes32 expected);

  event ForwarderUpdated(address indexed previous, address indexed current);
  event ExpectedAuthorUpdated(address indexed previous, address indexed current);
  event ExpectedWorkflowIdUpdated(bytes32 indexed previous, bytes32 indexed current);
  event OwnershipTransferred(address indexed previous, address indexed current);

  modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner();
    _;
  }

  constructor(address forwarder) {
    if (forwarder == address(0)) revert InvalidForwarderAddress();
    owner = msg.sender;
    s_forwarder = forwarder;
    emit OwnershipTransferred(address(0), msg.sender);
    emit ForwarderUpdated(address(0), forwarder);
  }

  function getForwarderAddress() external view returns (address) {
    return s_forwarder;
  }

  function getExpectedAuthor() external view returns (address) {
    return s_expectedAuthor;
  }

  function getExpectedWorkflowId() external view returns (bytes32) {
    return s_expectedWorkflowId;
  }

  /// @inheritdoc IReceiver
  function onReport(bytes calldata metadata, bytes calldata report) external override {
    if (msg.sender != s_forwarder) revert InvalidSender(msg.sender, s_forwarder);

    if (s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0)) {
      (bytes32 workflowId, address workflowOwner) = _decodeMetadata(metadata);
      if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
        revert InvalidWorkflowId(workflowId, s_expectedWorkflowId);
      }
      if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
        revert InvalidAuthor(workflowOwner, s_expectedAuthor);
      }
    }

    _processReport(report);
  }

  function setForwarderAddress(address forwarder) external onlyOwner {
    if (forwarder == address(0)) revert InvalidForwarderAddress();
    emit ForwarderUpdated(s_forwarder, forwarder);
    s_forwarder = forwarder;
  }

  function setExpectedAuthor(address author) external onlyOwner {
    emit ExpectedAuthorUpdated(s_expectedAuthor, author);
    s_expectedAuthor = author;
  }

  function setExpectedWorkflowId(bytes32 id) external onlyOwner {
    emit ExpectedWorkflowIdUpdated(s_expectedWorkflowId, id);
    s_expectedWorkflowId = id;
  }

  function transferOwnership(address next) external onlyOwner {
    emit OwnershipTransferred(owner, next);
    owner = next;
  }

  /// @dev Metadata layout: workflowId (32) | workflowName (10) | workflowOwner (20).
  function _decodeMetadata(bytes memory metadata)
    internal
    pure
    returns (bytes32 workflowId, address workflowOwner)
  {
    assembly {
      workflowId := mload(add(metadata, 32))
      workflowOwner := shr(mul(12, 8), mload(add(metadata, 74)))
    }
  }

  function _processReport(bytes calldata report) internal virtual;

  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
  }
}
