// Package types contains types that could be useful to other apps when interacting with this extension.
package types

import (
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// SayHelloRequest is the JSON payload sent via the Solidity contract.
type SayHelloRequest struct {
	Name string `json:"name"`
}

// SayHelloResponse is the JSON payload returned in ActionResult.Data.
type SayHelloResponse struct {
	Greeting       string `json:"greeting"`
	GreetingNumber int    `json:"greetingNumber"`
}

// SayGoodbyeRequest is the ABI-decoded payload sent via the Solidity contract.
type SayGoodbyeRequest struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

// SayGoodbyeResponse is the JSON payload returned in ActionResult.Data.
type SayGoodbyeResponse struct {
	Farewell       string `json:"farewell"`
	FarewellNumber int    `json:"farewellNumber"`
}

// SayGoodbyeMessageArg describes the ABI layout of SayGoodbyeMessage from the Solidity contract.
var SayGoodbyeMessageArg abi.Argument

func init() {
	tupleTy, _ := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "name", Type: "string"},
		{Name: "reason", Type: "string"},
	})
	SayGoodbyeMessageArg = abi.Argument{Type: tupleTy}
}

// CheckGreaterThan10Request is the JSON payload the caller ECIES-encrypts to
// the TEE's public key before submission. It never appears in plaintext
// anywhere outside the caller's own process and the enclave's memory.
type CheckGreaterThan10Request struct {
	Value int `json:"value"`
}

// CheckGreaterThan10Response is the JSON payload returned in ActionResult.Data.
// Deliberately carries only the verdict and a counter — never the input value
// (encrypted or otherwise) — since ActionResult.Data is signed and delivered
// back through the same public proxy/chain path the request came in on.
type CheckGreaterThan10Response struct {
	Result    bool `json:"result"`
	CheckedAt int  `json:"checkedAt"`
}

// EvidenceClaim is one party's claim inside a RuleOnEvidenceRequest — a
// timestamp they assert is true, checked against an independently
// established (FDC-verified) window rather than trusted on its own.
type EvidenceClaim struct {
	ClaimedTimestampUnix uint64 `json:"claimedTimestampUnix"`
}

// RuleOnEvidenceRequest is the JSON payload the caller ECIES-encrypts to the
// TEE's public key before submission — same pattern as
// CheckGreaterThan10Request, just carrying both parties' evidence and the
// window to check it against in one blob. EvidenceA is the claim that favors
// release (the condition was met); EvidenceB is the claim that favors
// holding the funds (the condition was not met). Fixed roles rather than a
// partyId keep the deterministic rule below a pure two-branch comparison.
type RuleOnEvidenceRequest struct {
	EscrowID        uint64        `json:"escrowId"`
	EvidenceA       EvidenceClaim `json:"evidenceA"`
	EvidenceB       EvidenceClaim `json:"evidenceB"`
	WindowStartUnix uint64        `json:"windowStartUnix"`
	WindowEndUnix   uint64        `json:"windowEndUnix"`
}

// RuleOnEvidenceVerdict is what processRuleOnEvidence computes internally.
// Never marshaled to JSON — the wire response is ABI-encoded (see
// RuleOnEvidenceVerdictArg) so WardenDisputeResolver can decode it cheaply
// on-chain after verifying the TEE's signature over it, unlike the
// JSON-encoded Hello World / threshold responses.
type RuleOnEvidenceVerdict struct {
	EscrowID     uint64
	Outcome      bool
	RulingNumber uint64
}

// RuleOnEvidenceVerdictArg describes the ABI layout of RuleOnEvidenceVerdict:
// abi.encode(uint256 escrowId, bool outcome, uint64 rulingNumber). Matches
// WardenDisputeResolver.sol's abi.decode(data, (uint256, bool, uint64)).
var RuleOnEvidenceVerdictArgs abi.Arguments

func init() {
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	boolTy, _ := abi.NewType("bool", "", nil)
	uint64Ty, _ := abi.NewType("uint64", "", nil)
	RuleOnEvidenceVerdictArgs = abi.Arguments{
		{Type: uint256Ty},
		{Type: boolTy},
		{Type: uint64Ty},
	}
}

// State holds the extension's observable state, returned by GET /state.
type State struct {
	GreetingCount int    `json:"greetingCount"`
	LastGreeting  string `json:"lastGreeting"`
	FarewellCount int    `json:"farewellCount"`
	LastFarewell  string `json:"lastFarewell"`
	CheckCount    int    `json:"checkCount"`
	LastResult    bool   `json:"lastResult"`
	DisputeCount  int    `json:"disputeCount"`
	LastVerdict   bool   `json:"lastVerdict"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
