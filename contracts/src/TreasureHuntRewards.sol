// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TreasureHuntRewards is Ownable, ERC20 {
    address public signer;

    // Used signed digests — kept for purchaseMerch, which uses an external
    // nonce so the same merch SKU can legitimately be bought repeatedly.
    mapping(bytes32 digest => bool used) public usedDigests;

    // Identity-keyed replay guard for object/social/qr rewards. The key is
    // amount-independent so a player who already claimed an object can never
    // re-claim it — even if a reward boost later raises the amount and the
    // backend would happily sign a higher value. The signature itself still
    // binds amount cryptographically (see _verifySigner) so an attacker
    // cannot replay a signature with an arbitrary amount.
    mapping(bytes32 claimKey => bool claimed) public claimedRewards;

    event ObjectClaimed(address indexed user, string objectId, uint256 amount);
    event SocialClaimed(address indexed user, string socialAccountId, uint256 amount);
    event QRClaimed(address indexed user, string qrCodeId, uint256 amount);
    event PollVoted(address indexed user, string pollId, uint256 optionsBitmap, uint256 amount);
    event MerchPurchased(address indexed user, uint256 merchId, uint256 price, uint256 nonce);

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) Ownable(msg.sender) {
        signer = msg.sender;
    }

    /**
     * @dev Recover the signer from an EIP-191 signed `messageHash` and revert
     * if it isn't the trusted backend signer. `messageHash` MUST include
     * `address(this)` so signatures can't be replayed across deployments.
     */
    function _verifySigner(bytes32 messageHash, bytes memory signature) internal view {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == signer, "Invalid signature");
    }

    /**
     * @dev Reject if the same digest has already been consumed, then mark it
     * consumed. Used by purchaseMerch (which signs a nonce, so the digest is
     * already unique per purchase).
     */
    function _consumeSignature(bytes32 messageHash, bytes memory signature) internal returns (bytes32) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(messageHash);
        require(!usedDigests[digest], "Signature already used");
        _verifySigner(messageHash, signature);
        usedDigests[digest] = true;
        return digest;
    }

    /**
     * @dev Verify the signature, then enforce one-claim-per-(user,type,id)
     * via the amount-independent claim key. Used by all reward paths so a
     * fresh signature for a higher (boosted) amount can't be used to
     * double-claim an already-claimed reward.
     */
    function _consumeReward(
        bytes32 claimKey,
        bytes32 messageHash,
        bytes memory signature
    ) internal {
        require(!claimedRewards[claimKey], "Reward already claimed");
        _verifySigner(messageHash, signature);
        claimedRewards[claimKey] = true;
    }

    function claimObjectReward(
        string memory objectId,
        uint256 amount,
        bytes memory signature
    ) external {
        bytes32 claimKey = keccak256(abi.encode(address(this), msg.sender, "object", objectId));
        bytes32 messageHash = keccak256(abi.encode(address(this), msg.sender, "object", objectId, amount));
        _consumeReward(claimKey, messageHash, signature);
        _mint(msg.sender, amount);
        emit ObjectClaimed(msg.sender, objectId, amount);
    }

    function claimSocialReward(
        string memory socialAccountId,
        uint256 amount,
        bytes memory signature
    ) external {
        bytes32 claimKey = keccak256(abi.encode(address(this), msg.sender, "social", socialAccountId));
        bytes32 messageHash = keccak256(abi.encode(address(this), msg.sender, "social", socialAccountId, amount));
        _consumeReward(claimKey, messageHash, signature);
        _mint(msg.sender, amount);
        emit SocialClaimed(msg.sender, socialAccountId, amount);
    }

    function claimQRReward(
        string memory qrCodeId,
        uint256 amount,
        bytes memory signature
    ) external {
        bytes32 claimKey = keccak256(abi.encode(address(this), msg.sender, "qr", qrCodeId));
        bytes32 messageHash = keccak256(abi.encode(address(this), msg.sender, "qr", qrCodeId, amount));
        _consumeReward(claimKey, messageHash, signature);
        _mint(msg.sender, amount);
        emit QRClaimed(msg.sender, qrCodeId, amount);
    }

    /**
     * @dev Submit a vote on a multi-choice poll. `optionsBitmap` packs the
     * picked option indices (bit i set = option i picked); the backend signs
     * a digest binding (pollId, optionsBitmap, amount) so on-chain replay of
     * a different bitmap is impossible. Same one-claim-per-(user, "poll", id)
     * semantics as object/social/qr — once consumed the user can never vote
     * on this poll again, even at a different reward amount.
     */
    function claimPollReward(
        string memory pollId,
        uint256 optionsBitmap,
        uint256 amount,
        bytes memory signature
    ) external {
        require(optionsBitmap != 0, "No options");
        bytes32 claimKey    = keccak256(abi.encode(address(this), msg.sender, "poll", pollId));
        bytes32 messageHash = keccak256(abi.encode(address(this), msg.sender, "poll", pollId, optionsBitmap, amount));
        _consumeReward(claimKey, messageHash, signature);
        _mint(msg.sender, amount);
        emit PollVoted(msg.sender, pollId, optionsBitmap, amount);
    }

    function purchaseMerch(
        uint256 merchId,
        uint256 price,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(price > 0, "Invalid price");
        require(balanceOf(msg.sender) >= price, "Insufficient balance");

        _consumeSignature(
            keccak256(abi.encode(address(this), msg.sender, "merch", merchId, price, nonce)),
            signature
        );
        _burn(msg.sender, price);
        emit MerchPurchased(msg.sender, merchId, price, nonce);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function mint(uint256 amount) external onlyOwner {
        _mint(msg.sender, amount);
    }
}
