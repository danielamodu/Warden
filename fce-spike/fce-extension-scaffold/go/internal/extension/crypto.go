package extension

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
)

// decryptViaNode calls the TEE node's local /decrypt endpoint (bound to
// localhost inside the container, never exposed publicly — see
// docs/extension-contract.md §3) to decrypt a payload the caller ECIES-
// encrypted to the TEE's public key before submitting it on-chain. Per the
// wire contract, encoding here is base64, not hex.
func decryptViaNode(signPort int, encrypted []byte) ([]byte, error) {
	reqBody, err := json.Marshal(map[string]string{
		"encryptedMessage": base64.StdEncoding.EncodeToString(encrypted),
	})
	if err != nil {
		return nil, fmt.Errorf("marshal decrypt request: %w", err)
	}

	url := fmt.Sprintf("http://localhost:%d/decrypt", signPort)
	resp, err := http.Post(url, "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("POST /decrypt: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("decrypt endpoint returned %d", resp.StatusCode)
	}

	var out struct {
		DecryptedMessage string `json:"decryptedMessage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode decrypt response: %w", err)
	}

	plaintext, err := base64.StdEncoding.DecodeString(out.DecryptedMessage)
	if err != nil {
		return nil, fmt.Errorf("base64-decode decrypted message: %w", err)
	}
	return plaintext, nil
}
