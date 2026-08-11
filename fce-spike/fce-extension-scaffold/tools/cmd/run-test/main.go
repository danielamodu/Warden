package main

import (
	"encoding/json"
	"flag"
	"strings"
	"time"

	"extension-scaffold/tools/pkg/configs"
	"extension-scaffold/tools/pkg/fccutils"
	"extension-scaffold/tools/pkg/support"
	instrutils "extension-scaffold/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

// Expected response shapes for the scaffold's Hello World operations.
//
// These are deliberately declared here rather than imported from the extension:
// this tool asserts on the *wire format*, and must run unchanged against every
// language implementation (see docs/extension-contract.md). Keeping them local
// is what lets tools/ stay independent of any one implementation.

type sayHelloResponse struct {
	Greeting       string `json:"greeting"`
	GreetingNumber int    `json:"greetingNumber"`
}

type sayGoodbyeResponse struct {
	Farewell       string `json:"farewell"`
	FarewellNumber int    `json:"farewellNumber"`
}

// checkGreaterThan10Response is asserted against on the wire — note there is
// no field here for the input value. If the extension ever regresses to
// echoing it back, this struct staying free of an input field is what makes
// that regression invisible to `json.Unmarshal` rather than a compile error;
// the real check is in verifyThresholdResult below, which asserts on the
// full raw JSON keyset.
type checkGreaterThan10Response struct {
	Result    bool `json:"result"`
	CheckedAt int  `json:"checkedAt"`
}

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	instructionSenderF := flag.String("instructionSender", "", "instructionSender address")
	flag.Parse()

	instructionSenderAddress := common.HexToAddress(*instructionSenderF)

	testSupport, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	// --- Generic: configure contract -----------------------------------------
	logger.Infof("Setting extension ID on instruction sender...")
	err = instrutils.SetExtensionId(testSupport, instructionSenderAddress)
	if err != nil {
		if strings.Contains(err.Error(), "already set") || strings.Contains(err.Error(), "Extension ID already set") {
			logger.Infof("Extension ID already set on contract, continuing")
		} else {
			logger.Errorf("setExtensionId failed: %s", err)
			fccutils.FatalWithCause(errors.Errorf(
				"setExtensionId failed — is the extension registered? Check that pre-build.sh completed successfully. Error: %s", err))
		}
	}

	// --- Test case 1: Send a SAY_HELLO instruction ---
	logger.Infof("Sending SAY_HELLO instruction...")

	payload, err := json.Marshal(map[string]interface{}{
		"name": "World",
	})
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	instructionId, _, err := instrutils.SendSayHello(testSupport, instructionSenderAddress, payload)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s", instructionId.Hex())

	time.Sleep(5 * time.Second)

	err = verifyHelloResult(*pf, instructionId)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Test passed: SAY_HELLO instruction processed successfully")

	// --- Test case 2: Send a SAY_GOODBYE instruction ---
	logger.Infof("Sending SAY_GOODBYE instruction...")

	goodbyeInstructionId, _, err := instrutils.SendSayGoodbye(testSupport, instructionSenderAddress, "World", "heading out")
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s", goodbyeInstructionId.Hex())

	time.Sleep(5 * time.Second)

	err = verifyGoodbyeResult(*pf, goodbyeInstructionId)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Test passed: SAY_GOODBYE instruction processed successfully")

	// --- Test case 3: CHECK_GREATER_THAN_10, input encrypted before it ever
	// leaves this process --------------------------------------------------
	logger.Infof("Fetching TEE public key for encryption...")
	teePubKey, err := instrutils.FetchTeePublicKeyForEncryption(*pf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	const testValue = 42 // > 10, so we expect result: true
	logger.Infof("Encrypting test value (never logged in plaintext beyond this line)...")
	encryptedValue, err := instrutils.EncryptCheckGreaterThan10Value(teePubKey, testValue)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("  Ciphertext: %d bytes (this, not the value, is what goes on-chain)", len(encryptedValue))

	logger.Infof("Sending CHECK_GREATER_THAN_10 instruction...")
	thresholdInstructionId, thresholdTxHash, err := instrutils.SendCheckGreaterThan10(testSupport, instructionSenderAddress, encryptedValue)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s, tx: %s", thresholdInstructionId.Hex(), thresholdTxHash.Hex())
	logger.Infof("  Check that tx's calldata on the explorer: it contains only the %d-byte ciphertext above, never %d.", len(encryptedValue), testValue)

	time.Sleep(5 * time.Second)

	err = verifyThresholdResult(*pf, thresholdInstructionId, true)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Test passed: CHECK_GREATER_THAN_10 instruction processed successfully, input never touched the chain")

	logger.Infof("All tests passed.")
}

func verifyHelloResult(proxyURL string, instructionId common.Hash) error {
	// --- Generic: poll proxy for result (do not modify) ---
	actionResponse, err := fccutils.ActionResult(proxyURL, instructionId)
	if err != nil {
		return err
	}
	actionResult := actionResponse.Result

	if actionResult.Status == 0 {
		return errors.Errorf("instruction processing failed: %s", actionResult.Log)
	}
	if actionResult.Status == 2 {
		return errors.New("instruction still pending after polling, expected completed")
	}

	if len(actionResult.Data) == 0 {
		return errors.New("expected response data but got none")
	}

	var resp sayHelloResponse
	err = json.Unmarshal(actionResult.Data, &resp)
	if err != nil {
		return errors.Errorf("failed to unmarshal response: %s", err)
	}

	if resp.Greeting == "" {
		return errors.New("expected non-empty Greeting")
	}
	if resp.GreetingNumber < 1 {
		return errors.Errorf("expected GreetingNumber >= 1, got %d", resp.GreetingNumber)
	}

	logger.Infof("Response data: %+v", resp)

	return nil
}

func verifyGoodbyeResult(proxyURL string, instructionId common.Hash) error {
	actionResponse, err := fccutils.ActionResult(proxyURL, instructionId)
	if err != nil {
		return err
	}
	actionResult := actionResponse.Result

	if actionResult.Status == 0 {
		return errors.Errorf("instruction processing failed: %s", actionResult.Log)
	}
	if actionResult.Status == 2 {
		return errors.New("instruction still pending after polling, expected completed")
	}

	if len(actionResult.Data) == 0 {
		return errors.New("expected response data but got none")
	}

	var resp sayGoodbyeResponse
	err = json.Unmarshal(actionResult.Data, &resp)
	if err != nil {
		return errors.Errorf("failed to unmarshal response: %s", err)
	}

	if resp.Farewell == "" {
		return errors.New("expected non-empty Farewell")
	}
	if resp.FarewellNumber < 1 {
		return errors.Errorf("expected FarewellNumber >= 1, got %d", resp.FarewellNumber)
	}

	logger.Infof("Response data: %+v", resp)

	return nil
}

func verifyThresholdResult(proxyURL string, instructionId common.Hash, wantResult bool) error {
	actionResponse, err := fccutils.ActionResult(proxyURL, instructionId)
	if err != nil {
		return err
	}
	actionResult := actionResponse.Result

	if actionResult.Status == 0 {
		return errors.Errorf("instruction processing failed: %s", actionResult.Log)
	}
	if actionResult.Status == 2 {
		return errors.New("instruction still pending after polling, expected completed")
	}

	if len(actionResult.Data) == 0 {
		return errors.New("expected response data but got none")
	}

	// Assert the raw JSON keyset is exactly {result, checkedAt} — nothing
	// else. This is what actually proves the plaintext input never rode
	// back out through the response, not just that Result has the right
	// value: an implementation that carelessly echoed the input back would
	// still pass a naive field-by-field check on checkGreaterThan10Response
	// but would fail this one.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(actionResult.Data, &raw); err != nil {
		return errors.Errorf("failed to unmarshal response as raw JSON: %s", err)
	}
	if len(raw) != 2 || raw["result"] == nil || raw["checkedAt"] == nil {
		keys := make([]string, 0, len(raw))
		for k := range raw {
			keys = append(keys, k)
		}
		return errors.Errorf("response JSON must contain exactly {result, checkedAt}, got keys: %v", keys)
	}

	var resp checkGreaterThan10Response
	if err := json.Unmarshal(actionResult.Data, &resp); err != nil {
		return errors.Errorf("failed to unmarshal response: %s", err)
	}

	if resp.Result != wantResult {
		return errors.Errorf("expected result=%v, got %v", wantResult, resp.Result)
	}
	if resp.CheckedAt < 1 {
		return errors.Errorf("expected CheckedAt >= 1, got %d", resp.CheckedAt)
	}

	logger.Infof("Response data: %+v", resp)

	return nil
}
