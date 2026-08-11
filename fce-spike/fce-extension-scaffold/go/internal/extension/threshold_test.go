package extension

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/crypto/ecies"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

// startMockSignPort stands in for the TEE node's local /decrypt endpoint
// (docs/extension-contract.md §3), using a real secp256k1 keypair and real
// ECIES decryption — the only thing it doesn't do is run inside actual
// Confidential Space hardware. It exists to prove the wire format and
// handler logic genuinely round-trip: encrypt client-side, decrypt only
// inside the (mock) enclave, never in between.
func startMockSignPort(t *testing.T) (*httptest.Server, *ecies.PrivateKey) {
	t.Helper()

	ecdsaKey, err := ecies.GenerateKey(rand.Reader, ecies.DefaultCurve, ecies.ECIES_AES128_SHA256)
	if err != nil {
		t.Fatalf("generate test TEE key: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /decrypt", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			EncryptedMessage string `json:"encryptedMessage"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		ciphertext, err := base64.StdEncoding.DecodeString(req.EncryptedMessage)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		plaintext, err := ecdsaKey.Decrypt(ciphertext, nil, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		resp := struct {
			DecryptedMessage string `json:"decryptedMessage"`
		}{DecryptedMessage: base64.StdEncoding.EncodeToString(plaintext)}
		_ = json.NewEncoder(w).Encode(resp)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, ecdsaKey
}

// encryptValueForTest mirrors exactly what a real caller does in
// tools/pkg/utils/instructions.go (EncryptCheckGreaterThan10Value) before
// ever submitting anything on-chain.
func encryptValueForTest(t *testing.T, pub *ecies.PublicKey, value int) []byte {
	t.Helper()
	plaintext, err := json.Marshal(types.CheckGreaterThan10Request{Value: value})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	ciphertext, err := ecies.Encrypt(rand.Reader, pub, plaintext, nil, nil)
	if err != nil {
		t.Fatalf("ECIES encrypt: %v", err)
	}
	return ciphertext
}

func TestProcessCheckGreaterThan10_ValueOver10_ReturnsTrue(t *testing.T) {
	srv, key := startMockSignPort(t)
	signPort := mustPort(t, srv.URL)

	e := &Extension{signPort: signPort}
	ciphertext := encryptValueForTest(t, &key.PublicKey, 42)

	action := buildTestAction(
		toHash(config.OPTypeThreshold),
		toHash(config.OPCommandCheckGreaterThan10),
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

	var resp types.CheckGreaterThan10Response
	unmarshalOrFatal(t, result.Data, &resp)
	if resp.Result != true {
		t.Errorf("expected result=true for value=42, got %v", resp.Result)
	}
	if resp.CheckedAt != 1 {
		t.Errorf("expected checkedAt=1, got %d", resp.CheckedAt)
	}

	// The core property under test: the raw input value must never appear
	// anywhere in the outbound response, encrypted or otherwise.
	assertNoLeak(t, result.Data, 42)
}

func TestProcessCheckGreaterThan10_ValueUnder10_ReturnsFalse(t *testing.T) {
	srv, key := startMockSignPort(t)
	signPort := mustPort(t, srv.URL)

	e := &Extension{signPort: signPort}
	ciphertext := encryptValueForTest(t, &key.PublicKey, 3)

	action := buildTestAction(
		toHash(config.OPTypeThreshold),
		toHash(config.OPCommandCheckGreaterThan10),
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

	var resp types.CheckGreaterThan10Response
	unmarshalOrFatal(t, result.Data, &resp)
	if resp.Result != false {
		t.Errorf("expected result=false for value=3, got %v", resp.Result)
	}

	assertNoLeak(t, result.Data, 3)
}

func TestProcessCheckGreaterThan10_BoundaryValue10_ReturnsFalse(t *testing.T) {
	srv, key := startMockSignPort(t)
	signPort := mustPort(t, srv.URL)

	e := &Extension{signPort: signPort}
	ciphertext := encryptValueForTest(t, &key.PublicKey, 10)

	action := buildTestAction(
		toHash(config.OPTypeThreshold),
		toHash(config.OPCommandCheckGreaterThan10),
		ciphertext,
	)

	_, body := e.processAction(action)
	var result teetypes.ActionResult
	unmarshalOrFatal(t, body, &result)
	var resp types.CheckGreaterThan10Response
	unmarshalOrFatal(t, result.Data, &resp)
	if resp.Result != false {
		t.Errorf("value=10 is not > 10, expected result=false, got %v", resp.Result)
	}
}

// TestProcessCheckGreaterThan10_WrongKey_FailsDecryption proves the flip
// side: ciphertext encrypted to a DIFFERENT key (i.e. not this enclave's)
// cannot be decrypted here, exactly as intended — only the holder of the
// matching private key (the real TEE, in production) can ever recover the
// plaintext.
func TestProcessCheckGreaterThan10_WrongKey_FailsDecryption(t *testing.T) {
	srv, _ := startMockSignPort(t) // mock server holds key A
	signPort := mustPort(t, srv.URL)

	otherKey, err := ecies.GenerateKey(rand.Reader, ecies.DefaultCurve, ecies.ECIES_AES128_SHA256)
	if err != nil {
		t.Fatalf("generate other key: %v", err)
	}

	e := &Extension{signPort: signPort}
	// Encrypted to key B, but the mock enclave only holds key A.
	ciphertext := encryptValueForTest(t, &otherKey.PublicKey, 42)

	action := buildTestAction(
		toHash(config.OPTypeThreshold),
		toHash(config.OPCommandCheckGreaterThan10),
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

func TestProcessCheckGreaterThan10_EmptyMessage(t *testing.T) {
	e := &Extension{signPort: 0}
	action := buildTestAction(
		toHash(config.OPTypeThreshold),
		toHash(config.OPCommandCheckGreaterThan10),
		nil,
	)

	status, body := e.processAction(action)
	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, status)
	}
	var result teetypes.ActionResult
	unmarshalOrFatal(t, body, &result)
	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0, got %d", result.Status)
	}
	if !contains(result.Log, "originalMessage is empty") {
		t.Errorf("expected log to mention empty message, got %q", result.Log)
	}
}

// --- small local helpers, kept in this file so extension_test.go's Hello
// World helpers stay untouched ---

func mustPort(t *testing.T, rawURL string) int {
	t.Helper()
	parts := strings.Split(rawURL, ":")
	portStr := parts[len(parts)-1]
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("parse port from %q: %v", rawURL, err)
	}
	return port
}

func unmarshalOrFatal(t *testing.T, data []byte, v interface{}) {
	t.Helper()
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("unmarshal %s: %v", data, err)
	}
}

// assertNoLeak checks the actual response payload (ActionResult.Data — the
// part of the wire format that carries the handler's own output) rather
// than the full HTTP body, since the latter is unavoidably full of
// coincidental decimal-digit substrings inside hex-encoded opType/opCommand/
// instructionId fields (e.g. "42" trivially appears inside arbitrary hex).
// Data itself is plain JSON, not hex, so this both confirms the keyset is
// exactly {result, checkedAt} and that neither key's value equals the raw
// input — the same two checks tools/cmd/run-test/main.go makes against a
// real deployment.
func assertNoLeak(t *testing.T, actionResultData []byte, value int) {
	t.Helper()

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(actionResultData, &raw); err != nil {
		t.Fatalf("response Data is not a JSON object: %v (%s)", err, actionResultData)
	}
	if len(raw) != 2 || raw["result"] == nil || raw["checkedAt"] == nil {
		keys := make([]string, 0, len(raw))
		for k := range raw {
			keys = append(keys, k)
		}
		t.Fatalf("response Data must contain exactly {result, checkedAt}, got keys: %v (%s)", keys, actionResultData)
	}

	needle := strconv.Itoa(value)
	if strings.Contains(string(actionResultData), needle) {
		t.Errorf("leak detected: response Data contains the raw input value %q:\n%s", needle, actionResultData)
	}
}
