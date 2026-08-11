// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal, self-contained interfaces (field order/types copied verbatim from
// flare-foundation/flare-solidity-periphery-package-mirror/coston2/{IPayment,IFdcVerification,IFlareContractRegistry}.sol)
// so this spike has no external dependency to install/compile.

interface IFlareContractRegistry {
    function getContractAddressByName(string calldata _name) external view returns (address);
}

interface IPayment {
    struct RequestBody {
        bytes32 transactionId;
        uint256 inUtxo;
        uint256 utxo;
    }

    struct ResponseBody {
        uint64 blockNumber;
        uint64 blockTimestamp;
        bytes32 sourceAddressHash;
        bytes32 sourceAddressesRoot;
        bytes32 receivingAddressHash;
        bytes32 intendedReceivingAddressHash;
        int256 spentAmount;
        int256 intendedSpentAmount;
        int256 receivedAmount;
        int256 intendedReceivedAmount;
        bytes32 standardPaymentReference;
        bool oneToOne;
        uint8 status;
    }

    struct Response {
        bytes32 attestationType;
        bytes32 sourceId;
        uint64 votingRound;
        uint64 lowestUsedTimestamp;
        RequestBody requestBody;
        ResponseBody responseBody;
    }

    struct Proof {
        bytes32[] merkleProof;
        Response data;
    }
}

interface IFdcVerification {
    function verifyPayment(IPayment.Proof calldata _proof) external view returns (bool);
}

/// @notice Phase-0 spike contract: takes an FDC Payment proof, checks it against
/// Flare's on-chain FdcVerification contract, and if valid, records it as a
/// confirmed real-world payment. Stands in for Warden's future escrow release check.
contract WardenPaymentAttestor {
    address public constant CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    struct ConfirmedPayment {
        uint64 blockTimestamp;
        bytes32 sourceAddressHash;
        bytes32 receivingAddressHash;
        int256 receivedAmount;
        bytes32 standardPaymentReference;
    }

    ConfirmedPayment[] public confirmedPayments;

    event PaymentConfirmed(
        uint256 indexed index,
        bytes32 receivingAddressHash,
        int256 receivedAmount
    );

    function getFdcVerification() public view returns (IFdcVerification) {
        address addr = IFlareContractRegistry(CONTRACT_REGISTRY).getContractAddressByName("FdcVerification");
        return IFdcVerification(addr);
    }

    /// @notice Verifies the proof against FDC and, if valid, stores + emits the payment.
    function confirmPayment(IPayment.Proof calldata _proof) external returns (bool) {
        bool ok = getFdcVerification().verifyPayment(_proof);
        require(ok, "FDC: invalid proof");

        confirmedPayments.push(
            ConfirmedPayment({
                blockTimestamp: _proof.data.responseBody.blockTimestamp,
                sourceAddressHash: _proof.data.responseBody.sourceAddressHash,
                receivingAddressHash: _proof.data.responseBody.receivingAddressHash,
                receivedAmount: _proof.data.responseBody.receivedAmount,
                standardPaymentReference: _proof.data.responseBody.standardPaymentReference
            })
        );

        emit PaymentConfirmed(
            confirmedPayments.length - 1,
            _proof.data.responseBody.receivingAddressHash,
            _proof.data.responseBody.receivedAmount
        );

        return true;
    }

    function paymentCount() external view returns (uint256) {
        return confirmedPayments.length;
    }
}
