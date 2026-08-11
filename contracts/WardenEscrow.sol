// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal ERC20 interface — FXRP (the FAssets-minted representation of XRP
// on Coston2) is a standard ERC20/IFAsset token, so no custom interface is
// needed beyond the usual transfer methods.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

// Minimal AssetManager interface — just the pieces needed to redeem FXRP
// back to real XRP on XRPL. Field order/types copied verbatim from
// flare-foundation/flare-solidity-periphery-package-mirror/coston2/IAssetManager.sol.
interface IAssetManager {
    function lotSize() external view returns (uint256 _lotSizeUBA);

    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString,
        address payable _executor
    ) external payable returns (uint256 _redeemedAmountUBA);
}

/// @title WardenEscrow — Phase 1 (fund + hold) + Phase 2 (generic release).
/// @notice Accepts FXRP funding from a buyer and tracks it against a generic
/// "condition" reference. This contract still knows nothing about what a
/// condition *means* — no insurance-specific fields, no trade-finance-specific
/// fields. What Phase 2 adds is a single, generic release hook: a designated
/// `resolver` contract (vertical-specific, swappable) calls `resolveAndRelease`
/// once it has independently verified that a condition attested true. This
/// contract's only job at that point is the mechanical part everyone needs
/// regardless of vertical: mark resolved, and pay out real XRP on XRPL via
/// FAssets redemption. A future trade-finance or different-insurance resolver
/// reuses this exact same entry point.
contract WardenEscrow {
    IERC20 public immutable fxrp;
    IAssetManager public immutable assetManager;

    // The only contract allowed to call resolveAndRelease. Vertical-specific
    // logic (e.g. verifying a Web2Json weather attestation) lives entirely in
    // the resolver, never here. Settable exactly once, mirroring the
    // "setExtensionId() can only be set once" pattern used elsewhere in this
    // project — avoids a constructor circular dependency (escrow needs the
    // resolver's address; the resolver needs the escrow's address) without
    // leaving the resolver permanently changeable.
    address public resolver;

    enum ConditionStatus {
        Unresolved,
        Resolved
    }

    struct Escrow {
        // Opaque reference to whatever condition governs release. This
        // contract does not interpret it — the resolver does, e.g. by
        // checking it against an FDC attestation proof, an oracle, or a
        // manual multisig decision.
        bytes32 conditionId;
        address buyer;
        // EVM address recorded for future phases (e.g. dispute-path
        // notifications/governance). Not used for payout — payout goes to
        // beneficiaryXrplAddress below, since FAssets redemption pays out
        // on the underlying chain (XRPL), not on Flare.
        address beneficiary;
        // XRPL address that receives the actual XRP payout on release.
        string beneficiaryXrplAddress;
        // Amount of FXRP held, in FXRP's own smallest unit (UBA — FXRP has
        // 6 decimals, same as XRP drops).
        uint256 amount;
        ConditionStatus status;
        uint64 fundedAt;
    }

    uint256 public nextEscrowId;
    mapping(uint256 => Escrow) public escrows;

    event EscrowFunded(
        uint256 indexed escrowId,
        bytes32 indexed conditionId,
        address indexed buyer,
        string beneficiaryXrplAddress,
        uint256 amount
    );

    event EscrowResolved(uint256 indexed escrowId, bool outcome);

    event EscrowReleased(uint256 indexed escrowId, string beneficiaryXrplAddress, uint256 redeemedAmountUBA);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }

    constructor(address _fxrp, address _assetManager) {
        require(_fxrp != address(0), "fxrp = 0");
        require(_assetManager != address(0), "assetManager = 0");
        fxrp = IERC20(_fxrp);
        assetManager = IAssetManager(_assetManager);
    }

    /// @notice Sets the resolver contract. Can only be set once (from the
    /// zero address), so once wired up it cannot be silently swapped.
    function setResolver(address _resolver) external {
        require(resolver == address(0), "resolver already set");
        require(_resolver != address(0), "resolver = 0");
        resolver = _resolver;
    }

    /// @notice Buyer funds a new escrow against a generic condition reference.
    /// Pulls `amount` FXRP from `msg.sender`, who must have called
    /// `approve(address(this), amount)` on the FXRP token beforehand.
    /// @param conditionId opaque id/hash identifying the condition that will
    ///        eventually govern release — meaning is defined entirely by the
    ///        resolver, this contract does not care.
    /// @param beneficiaryXrplAddress XRPL address to pay out to on release.
    /// @param amount amount of FXRP (in UBA) to pull into escrow.
    /// @return escrowId identifier for the newly created escrow record.
    function fund(
        bytes32 conditionId,
        string calldata beneficiaryXrplAddress,
        uint256 amount
    ) external returns (uint256 escrowId) {
        require(amount > 0, "amount = 0");
        require(bytes(beneficiaryXrplAddress).length > 0, "beneficiaryXrplAddress empty");

        bool ok = fxrp.transferFrom(msg.sender, address(this), amount);
        require(ok, "FXRP transferFrom failed");

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            conditionId: conditionId,
            buyer: msg.sender,
            beneficiary: msg.sender,
            beneficiaryXrplAddress: beneficiaryXrplAddress,
            amount: amount,
            status: ConditionStatus.Unresolved,
            fundedAt: uint64(block.timestamp)
        });

        emit EscrowFunded(escrowId, conditionId, msg.sender, beneficiaryXrplAddress, amount);
    }

    /// @notice Called by the resolver once it has independently verified the
    /// condition's outcome. If true, redeems the escrow's FXRP for real XRP
    /// paid to beneficiaryXrplAddress on XRPL — no further manual steps.
    /// If false, just marks the escrow resolved (funds stay put; a later
    /// dispute/refund phase would build on top of this, same as Phase 1
    /// left release for Phase 2 to build on top of fund+hold).
    /// @return redeemedAmountUBA the amount actually submitted for redemption
    ///         (0 if outcome was false).
    function resolveAndRelease(
        uint256 escrowId,
        bool outcome
    ) external onlyResolver returns (uint256 redeemedAmountUBA) {
        Escrow storage e = escrows[escrowId];
        require(e.status == ConditionStatus.Unresolved, "already resolved");

        e.status = ConditionStatus.Resolved;
        emit EscrowResolved(escrowId, outcome);

        if (outcome) {
            uint256 lotSizeUBA = assetManager.lotSize();
            uint256 lots = e.amount / lotSizeUBA;
            require(lots > 0, "amount below one lot");

            redeemedAmountUBA = assetManager.redeem(lots, e.beneficiaryXrplAddress, payable(address(0)));
            emit EscrowReleased(escrowId, e.beneficiaryXrplAddress, redeemedAmountUBA);
        }
    }

    /// @notice Full record for a given escrow id.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    /// @notice Total FXRP actually held by this contract right now — an
    /// independent, on-chain-verifiable check that funding really happened,
    /// separate from the internal escrows accounting above.
    function heldBalance() external view returns (uint256) {
        return fxrp.balanceOf(address(this));
    }
}
