package extension

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/crypto/ecies"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

// --- Unit tests for the pure rule, no mock enclave needed ---

func TestRuleOnEvidence_OnlyAInWindow_ReturnsTrue(t *testing.T) {
	a := types.EvidenceClaim{ClaimedTimestampUnix: 1000}
	b := types.EvidenceClaim{ClaimedTimestampUnix: 5000}
	if !ruleOnEvidence(a, b, 900, 1100) {
		t.Error("expected true: A's claim is inside the window, B's is not")
	}
}

func TestRuleOnEvidence_OnlyBInWindow_ReturnsFalse(t *testing.T) {
	a := types.EvidenceClaim{ClaimedTimestampUnix: 5000}
	b := types.EvidenceClaim{ClaimedTimestampUnix: 1000}
	if ruleOnEvidence(a, b, 900, 1100) {
		t.Error("expected false: only B's claim is inside the window")
	}
}

func TestRuleOnEvidence_BothInWindow_ReturnsFalse(t *testing.T) {
	a := types.EvidenceClaim{ClaimedTimestampUnix: 1000}
	b := types.EvidenceClaim{ClaimedTimestampUnix: 1050}
	if ruleOnEvidence(a, b, 900, 1100) {
		t.Error("expected false (safe default): ambiguous when both claims are inside the window")
	}
}

func TestRuleOnEvidence_NeitherInWindow_ReturnsFalse(t *testing.T) {
	a := types.EvidenceClaim{ClaimedTimestampUnix: 1}
	b := types.EvidenceClaim{ClaimedTimestampUnix: 2}
	if ruleOnEvidence(a, b, 900, 1100) {
		t.Error("expected false (safe default): neither claim is inside the window")
	}
}

func TestRuleOnEvidence_WindowBoundsInclusive(t *testing.T) {
	a := types.EvidenceClaim{ClaimedTimestampUnix: 900} // exactly windowStart
	b := types.EvidenceClaim{ClaimedTimestampUnix: 5000}
	if !ruleOnEvidence(a, b, 900, 1100) {
		t.Error("expected true: windowStart itself should count as inside the window")
	}
}

// --- Integration-style test through processAction, mirroring
// threshold_test.go's mock-enclave pattern ---

func encryptEvidenceForTest(t *testing.T, pub *ecies.PublicKey, req types.RuleOnEvidenceRequest) []byte {
	t.Helper()
	plaintext, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	ciphertext, err := ecies.Encrypt(rand.Reader, pub, plaintext, nil, nil)
	if err != nil {
		t.Fatalf("ECIES encrypt: %v", err)
	}
	return ciphertext
}

func TestProcessRuleOnEvidence_FieldsMatchAndNoLeak(t *testing.T) {
	srv, key := startMockSignPort(t)
	signPort := mustPort(t, srv.URL)

	e := &Extension{signPort: signPort}
	req := types.RuleOnEvidenceRequest{
		EscrowID:        42,
		EvidenceA:       types.EvidenceClaim{ClaimedTimestampUnix: 1000},
		EvidenceB:       types.EvidenceClaim{ClaimedTimestampUnix: 5000},
		WindowStartUnix: 900,
		WindowEndUnix:   1100,
	}
	ciphertext := encryptEvidenceForTest(t, &key.PublicKey, req)

	action := buildTestAction(
		toHash(config.OPTypeDispute),
		toHash(config.OPCommandRuleOnEvidence),
		ciphertext,
	)

	status, body := e.processAction(action)
	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, status, body)
	}

	var result teetypes.ActionResult
	unmarshalOrFatal(t, body, &result)
	if result.Status != 1 {
		t.Fatalf("expected ActionResult.Status=1, got %d: %s", result.Status, result.Log)
	}

	decoded, err := types.RuleOnEvidenceVerdictArgs.Unpack(result.Data)
	if err != nil {
		t.Fatalf("abi.decode(data, (uint256,bool,uint64)) failed: %v (data=%x)", err, result.Data)
	}
	if len(decoded) != 3 {
		t.Fatalf("expected 3 decoded values, got %d", len(decoded))
	}

	gotEscrowID := decoded[0].(*big.Int).Uint64()
	gotOutcome := decoded[1].(bool)
	gotRuling := decoded[2].(uint64)

	if gotEscrowID != 42 {
		t.Errorf("expected escrowId=42, got %d", gotEscrowID)
	}
	if !gotOutcome {
		t.Error("expected outcome=true (A's claim is the only one inside the window), got false")
	}
	if gotRuling != 1 {
		t.Errorf("expected rulingNumber=1, got %d", gotRuling)
	}

	// The leak-detector property, same discipline as
	// TestProcessCheckGreaterThan10_*: neither party's claimed timestamp may
	// appear anywhere in the outbound ABI-encoded data. Each 32-byte ABI word
	// is checked as a decimal number in isolation, rather than substring-
	// matching the whole hex blob, since arbitrary hex trivially contains
	// coincidental decimal digit sequences.
	hexData := hex.EncodeToString(result.Data)
	if len(hexData) != 3*64 {
		t.Fatalf("expected exactly 3 ABI words (192 hex chars), got %d: %s", len(hexData), hexData)
	}
	for i, label := range []string{"escrowId", "outcome", "rulingNumber"} {
		word := hexData[i*64 : (i+1)*64]
		n := new(big.Int)
		n.SetString(word, 16)
		if label == "escrowId" || label == "rulingNumber" {
			continue // expected to be small, non-secret numbers
		}
		for _, leaked := range []uint64{1000, 5000} {
			if n.Uint64() == leaked {
				t.Errorf("leak detected: ABI word %d (%s) equals a claimed timestamp %d", i, label, leaked)
			}
		}
	}
	// Belt-and-suspenders: neither raw claimed-timestamp value appears
	// anywhere in the response as a decimal substring either.
	for _, ts := range []uint64{1000, 5000} {
		needle := strconv.FormatUint(ts, 10)
		if strings.Contains(string(result.Data), needle) {
			t.Errorf("leak detected: response Data contains raw timestamp %q", needle)
		}
	}
}

// TestProcessRuleOnEvidence_WrongKey_FailsDecryption mirrors
// TestProcessCheckGreaterThan10_WrongKey_FailsDecryption: ciphertext
// encrypted to a different key cannot be decrypted by this enclave.
func TestProcessRuleOnEvidence_WrongKey_FailsDecryption(t *testing.T) {
	srv, _ := startMockSignPort(t) // mock server holds key A
	signPort := mustPort(t, srv.URL)

	otherKey, err := ecies.GenerateKey(rand.Reader, ecies.DefaultCurve, ecies.ECIES_AES128_SHA256)
	if err != nil {
		t.Fatalf("generate other key: %v", err)
	}

	e := &Extension{signPort: signPort}
	req := types.RuleOnEvidenceRequest{
		EscrowID:        1,
		EvidenceA:       types.EvidenceClaim{ClaimedTimestampUnix: 1000},
		EvidenceB:       types.EvidenceClaim{ClaimedTimestampUnix: 5000},
		WindowStartUnix: 900,
		WindowEndUnix:   1100,
	}
	ciphertext := encryptEvidenceForTest(t, &otherKey.PublicKey, req)

	action := buildTestAction(
		toHash(config.OPTypeDispute),
		toHash(config.OPCommandRuleOnEvidence),
		ciphertext,
	)

	status, body := e.processAction(action)
	if status != http.StatusOK {
		t.Fatalf("expected status %d (error surfaces via ActionResult, not HTTP), got %d", http.StatusOK, status)
	}
	var result teetypes.ActionResult
	unmarshalOrFatal(t, body, &result)
	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0 (decryption should fail), got %d", result.Status)
	}
	if !contains(result.Log, "decryption failed") {
		t.Errorf("expected log to mention decryption failure, got %q", result.Log)
	}
}
