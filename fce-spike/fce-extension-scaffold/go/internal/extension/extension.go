package extension

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	greetingCount int
	lastGreeting  string
	farewellCount int
	lastFarewell  string

	// signPort is the TEE node's local /decrypt endpoint port, used by
	// processCheckGreaterThan10 to decrypt inputs inside the enclave.
	signPort int

	checkCount int
	lastResult bool

	disputeCount int
	lastVerdict  bool
}

// --- DO NOT MODIFY: New(), actionHandler() are boilerplate.
func New(extensionPort, signPort int) *Extension {
	e := &Extension{signPort: signPort}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

// stateHandler() structure is boilerplate but update the State field mapping to match your Extension fields.
func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	e.mu.RLock()
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			GreetingCount: e.greetingCount,
			LastGreeting:  e.lastGreeting,
			FarewellCount: e.farewellCount,
			LastFarewell:  e.lastFarewell,
			CheckCount:    e.checkCount,
			LastResult:    e.lastResult,
			DisputeCount:  e.disputeCount,
			LastVerdict:   e.lastVerdict,
		},
	}
	e.mu.RUnlock()

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	switch {
	case dataFixed.OPType == teeutils.ToHash(config.OPTypeGreeting):
		return e.processGreeting(action, dataFixed)

	case dataFixed.OPType == teeutils.ToHash(config.OPTypeThreshold):
		return e.processThreshold(action, dataFixed)

	case dataFixed.OPType == teeutils.ToHash(config.OPTypeDispute):
		return e.processDispute(action, dataFixed)

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected one of [%s (%s), %s (%s), %s (%s)]",
			dataFixed.OPType.Hex(),
			teeutils.ToHash(config.OPTypeGreeting).Hex(), config.OPTypeGreeting,
			teeutils.ToHash(config.OPTypeThreshold).Hex(), config.OPTypeThreshold,
			teeutils.ToHash(config.OPTypeDispute).Hex(), config.OPTypeDispute,
		))
	}
}

// processDispute routes DISPUTE instructions by OPCommand.
func (e *Extension) processDispute(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandRuleOnEvidence):
		ar := e.processRuleOnEvidence(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s)",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandRuleOnEvidence).Hex(), config.OPCommandRuleOnEvidence,
		))
	}
}

// processThreshold routes THRESHOLD instructions by OPCommand.
func (e *Extension) processThreshold(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandCheckGreaterThan10):
		ar := e.processCheckGreaterThan10(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s)",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandCheckGreaterThan10).Hex(), config.OPCommandCheckGreaterThan10,
		))
	}
}

// processGreeting routes GREETING instructions by OPCommand.
func (e *Extension) processGreeting(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandSayHello):
		ar := e.processSayHello(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	case df.OPCommand == teeutils.ToHash(config.OPCommandSayGoodbye):
		ar := e.processSayGoodbye(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected one of [%s (%s), %s (%s)]",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandSayHello).Hex(), config.OPCommandSayHello,
			teeutils.ToHash(config.OPCommandSayGoodbye).Hex(), config.OPCommandSayGoodbye,
		))
	}
}

// processSayHello handles SAY_HELLO instructions: returns a greeting and tracks count.
func (e *Extension) processSayHello(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	var req types.SayHelloRequest
	dec := json.NewDecoder(bytes.NewReader(df.OriginalMessage))
	dec.DisallowUnknownFields()
	err := dec.Decode(&req)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	if req.Name == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("name must not be empty"))
	}

	e.mu.Lock()
	e.greetingCount++
	greetingNumber := e.greetingCount
	greeting := fmt.Sprintf("Hello, %s! Welcome to Flare Confidential Compute.", req.Name)
	e.lastGreeting = greeting
	e.mu.Unlock()

	resp := types.SayHelloResponse{
		Greeting:       greeting,
		GreetingNumber: greetingNumber,
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// processSayGoodbye handles SAY_GOODBYE instructions: returns a farewell and tracks count.
func (e *Extension) processSayGoodbye(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	var req types.SayGoodbyeRequest
	err := structs.DecodeTo(types.SayGoodbyeMessageArg, df.OriginalMessage, &req)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	if req.Name == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("name must not be empty"))
	}

	e.mu.Lock()
	e.farewellCount++
	farewellNumber := e.farewellCount
	farewell := fmt.Sprintf("Goodbye, %s! Reason: %s", req.Name, req.Reason)
	e.lastFarewell = farewell
	e.mu.Unlock()

	resp := types.SayGoodbyeResponse{
		Farewell:       farewell,
		FarewellNumber: farewellNumber,
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// processCheckGreaterThan10 handles CHECK_GREATER_THAN_10 instructions.
//
// df.OriginalMessage is ciphertext — the caller ECIES-encrypted
// {"value": N} to the TEE's public key before sending it on-chain, so the
// public transaction that triggered this call never carried the plaintext.
// Decryption happens here, inside the enclave, via the TEE node's local
// /decrypt endpoint (never reachable from outside the container). The
// decrypted value and the request struct that holds it go out of scope at
// the end of this function: nothing derived from them is logged, stored
// beyond the boolean/count fields below, or included in the response —
// ActionResult.Data carries only the verdict.
func (e *Extension) processCheckGreaterThan10(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}

	plaintext, err := decryptViaNode(e.signPort, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decryption failed: %w", err))
	}

	var req types.CheckGreaterThan10Request
	dec := json.NewDecoder(bytes.NewReader(plaintext))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding decrypted request: %w", err))
	}

	result := req.Value > 10

	e.mu.Lock()
	e.checkCount++
	checkedAt := e.checkCount
	e.lastResult = result
	e.mu.Unlock()

	resp := types.CheckGreaterThan10Response{
		Result:    result,
		CheckedAt: checkedAt,
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// ruleOnEvidence is the deterministic rules-engine at the heart of
// RULE_ON_EVIDENCE: which of two conflicting timestamp claims is consistent
// with a window that was independently established (e.g. via an FDC
// attestation) before either party spoke. A pure function — no I/O, no TEE
// dependency — so it's testable without a mock enclave and reviewable as
// exactly the rule it claims to be.
//
// evidenceA is the claim that favors release; evidenceB is the claim that
// favors holding funds. Exactly one claim falling inside the window is what
// makes a verdict — anything ambiguous (both inside, both outside, a tie)
// defaults to false, matching WardenEscrow's existing "false means funds
// stay put" semantics: the safe default is no payout, not an arbitrary pick.
func ruleOnEvidence(evidenceA, evidenceB types.EvidenceClaim, windowStart, windowEnd uint64) bool {
	inWindow := func(ts uint64) bool { return ts >= windowStart && ts <= windowEnd }
	aInWindow := inWindow(evidenceA.ClaimedTimestampUnix)
	bInWindow := inWindow(evidenceB.ClaimedTimestampUnix)
	return aInWindow && !bInWindow
}

// processRuleOnEvidence handles RULE_ON_EVIDENCE instructions.
//
// df.OriginalMessage is ciphertext — the caller ECIES-encrypted the full
// RuleOnEvidenceRequest (both parties' evidence plus the window) to the
// TEE's public key before sending it on-chain, exactly like
// processCheckGreaterThan10. Decryption happens here, inside the enclave.
// Unlike every other handler in this extension, the response is ABI-encoded
// rather than JSON: WardenDisputeResolver needs to abi.decode it on-chain
// after verifying this result's signature, and ABI encoding is what makes
// that cheap. The response carries only escrowId, the boolean verdict, and a
// counter — never either party's claimed timestamp.
func (e *Extension) processRuleOnEvidence(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}

	plaintext, err := decryptViaNode(e.signPort, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decryption failed: %w", err))
	}

	var req types.RuleOnEvidenceRequest
	dec := json.NewDecoder(bytes.NewReader(plaintext))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding decrypted request: %w", err))
	}
	if req.WindowEndUnix < req.WindowStartUnix {
		return buildResult(action, df, nil, 0, fmt.Errorf("windowEndUnix before windowStartUnix"))
	}

	outcome := ruleOnEvidence(req.EvidenceA, req.EvidenceB, req.WindowStartUnix, req.WindowEndUnix)

	e.mu.Lock()
	e.disputeCount++
	rulingNumber := e.disputeCount
	e.lastVerdict = outcome
	e.mu.Unlock()

	data, err := types.RuleOnEvidenceVerdictArgs.Pack(
		new(big.Int).SetUint64(req.EscrowID),
		outcome,
		uint64(rulingNumber),
	)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("abi-encoding verdict: %w", err))
	}

	return buildResult(action, df, data, 1, nil)
}
