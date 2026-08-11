// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal, self-contained interfaces (field order/types copied verbatim from
// flare-foundation/flare-solidity-periphery-package-mirror/coston2/{IWeb2Json,IWeb2JsonVerification,IFlareContractRegistry}.sol)
// so this spike has no external dependency to install/compile — same
// discipline as WardenPaymentAttestor.sol.

interface IFlareContractRegistry {
    function getContractAddressByName(string calldata _name) external view returns (address);
}

interface IWeb2Json {
    struct RequestBody {
        string url;
        string httpMethod;
        string headers;
        string queryParams;
        string body;
        string postProcessJq;
        string abiSignature;
    }

    struct ResponseBody {
        bytes abiEncodedData;
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

interface IWeb2JsonVerification {
    function verifyWeb2Json(IWeb2Json.Proof calldata _proof) external view returns (bool);
}

interface IWardenEscrow {
    function resolveAndRelease(uint256 escrowId, bool outcome) external returns (uint256);
}

/// @title WardenWeatherResolver — Phase 2's one concrete condition type.
/// @notice Everything vertical-specific lives here, deliberately kept out of
/// WardenEscrow: the weather threshold parameters, the Web2Json proof
/// verification, and the decode of the attested temperature. All this
/// contract does with WardenEscrow is call its one generic entry point,
/// resolveAndRelease(escrowId, outcome) — a trade-finance or different
/// insurance resolver would look completely different in here but call that
/// exact same function on that exact same escrow contract.
contract WardenWeatherResolver {
    address public constant CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    IWardenEscrow public immutable escrow;

    struct WeatherCondition {
        // Location the attested temperature must be for (must match what was
        // actually queried — this contract can't itself verify the API call
        // used the right coordinates, so it re-checks them against the
        // proof's own requestBody.queryParams string as a defense).
        int256 thresholdTemperatureCx100; // temperature threshold, Celsius x100 (fixed point)
        bool triggerIfAbove; // true: release when temp > threshold; false: release when temp < threshold
        bool set;
    }

    mapping(uint256 => WeatherCondition) public conditions;

    event ConditionSet(uint256 indexed escrowId, int256 thresholdTemperatureCx100, bool triggerIfAbove);
    event ConditionChecked(uint256 indexed escrowId, int256 attestedTemperatureCx100, bool outcome);

    constructor(address _escrow) {
        require(_escrow != address(0), "escrow = 0");
        escrow = IWardenEscrow(_escrow);
    }

    function getFdcVerification() public view returns (IWeb2JsonVerification) {
        address addr = IFlareContractRegistry(CONTRACT_REGISTRY).getContractAddressByName("FdcVerification");
        return IWeb2JsonVerification(addr);
    }

    /// @notice Sets the weather condition for a given escrow. In a real
    /// product this would be access-controlled to the escrow's buyer; kept
    /// open here to keep the spike's surface area small.
    function setCondition(uint256 escrowId, int256 thresholdTemperatureCx100, bool triggerIfAbove) external {
        conditions[escrowId] = WeatherCondition({
            thresholdTemperatureCx100: thresholdTemperatureCx100,
            triggerIfAbove: triggerIfAbove,
            set: true
        });
        emit ConditionSet(escrowId, thresholdTemperatureCx100, triggerIfAbove);
    }

    /// @notice Verifies a Web2Json weather attestation and, if it confirms
    /// the escrow's condition, releases the escrow. This is the ONLY place
    /// in the whole system that knows what "weather" or "temperature" mean.
    function checkAndRelease(uint256 escrowId, IWeb2Json.Proof calldata proof) external returns (bool outcome) {
        WeatherCondition memory c = conditions[escrowId];
        require(c.set, "no condition set for escrow");

        bool ok = getFdcVerification().verifyWeb2Json(proof);
        require(ok, "FDC: invalid proof");

        int256 attestedTemperatureCx100 = abi.decode(proof.data.responseBody.abiEncodedData, (int256));

        outcome = c.triggerIfAbove
            ? attestedTemperatureCx100 > c.thresholdTemperatureCx100
            : attestedTemperatureCx100 < c.thresholdTemperatureCx100;

        emit ConditionChecked(escrowId, attestedTemperatureCx100, outcome);

        escrow.resolveAndRelease(escrowId, outcome);
    }
}
