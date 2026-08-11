// dispute-demo sends a RULE_ON_EVIDENCE instruction through the live TEE
// with two conflicting evidence claims, polls for the TEE's signed verdict,
// and writes everything WardenDisputeResolver.submitVerdict() needs (on the
// Warden/Node.js side) to a JSON file. Mirrors tools/cmd/run-test's pattern,
// but this tool's job ends at "get a verified verdict" — it does not touch
// WardenEscrow or WardenDisputeResolver itself, which live outside this
// scaffold entirely.
package main

import (
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
	"time"

	"extension-scaffold/tools/pkg/configs"
	"extension-scaffold/tools/pkg/fccutils"
	"extension-scaffold/tools/pkg/support"
	instrutils "extension-scaffold/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

// verdictArgs decodes the ABI-encoded ActionResult.Data this tool receives
// back — a local copy of the same layout go/pkg/types.RuleOnEvidenceVerdictArgs
// packs, kept local for the same reason every other type in this tool is
// local: tools/ stays independent of any one language implementation.
var verdictArgs abi.Arguments

func init() {
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	boolTy, _ := abi.NewType("bool", "", nil)
	uint64Ty, _ := abi.NewType("uint64", "", nil)
	verdictArgs = abi.Arguments{{Type: uint256Ty}, {Type: boolTy}, {Type: uint64Ty}}
}

// disputeVerdictOutput is what gets written to the output JSON file — every
// field WardenDisputeResolver.submitVerdict() takes, plus the decoded
// verdict for human/script convenience.
type disputeVerdictOutput struct {
	TeeID            string `json:"teeId"`
	InstructionID    string `json:"instructionId"`
	SubmissionTag    string `json:"submissionTag"`
	Status           uint8  `json:"status"`
	DataHex          string `json:"dataHex"`
	SignatureHex     string `json:"signatureHex"`
	DecodedEscrowID  uint64 `json:"decodedEscrowId"`
	DecodedOutcome   bool   `json:"decodedOutcome"`
	DecodedRulingNum uint64 `json:"decodedRulingNumber"`
	InstructionTxHash string `json:"instructionTxHash"`
}

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	instructionSenderF := flag.String("instructionSender", "", "instructionSender address")
	escrowID := flag.Uint64("escrowId", 0, "Warden escrow id this dispute is about")
	evidenceATs := flag.Uint64("evidenceA", 0, "evidence A's claimed unix timestamp (favors release)")
	evidenceBTs := flag.Uint64("evidenceB", 0, "evidence B's claimed unix timestamp (favors holding funds)")
	windowStart := flag.Uint64("windowStart", 0, "FDC-verified window start, unix timestamp")
	windowEnd := flag.Uint64("windowEnd", 0, "FDC-verified window end, unix timestamp")
	outFile := flag.String("out", "dispute-verdict.json", "path to write the verdict JSON to")
	flag.Parse()

	if *windowEnd < *windowStart {
		fccutils.FatalWithCause(errors.New("-windowEnd must be >= -windowStart"))
	}

	instructionSenderAddress := common.HexToAddress(*instructionSenderF)

	testSupport, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	logger.Infof("Fetching TEE info (public key + on-chain teeId)...")
	teeInfo, err := fccutils.TeeInfo(*pf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	teeID, _, err := fccutils.TeeProxyId(teeInfo)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("deriving teeId from TEE info: %s", err))
	}
	teePubKey, err := instrutils.FetchTeePublicKeyForEncryption(*pf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	req := instrutils.RuleOnEvidenceRequest{
		EscrowID:        *escrowID,
		EvidenceA:       instrutils.EvidenceClaim{ClaimedTimestampUnix: *evidenceATs},
		EvidenceB:       instrutils.EvidenceClaim{ClaimedTimestampUnix: *evidenceBTs},
		WindowStartUnix: *windowStart,
		WindowEndUnix:   *windowEnd,
	}

	logger.Infof("Encrypting evidence (escrowId=%d) — neither claimed timestamp will ever appear in plaintext beyond this line...", *escrowID)
	encryptedEvidence, err := instrutils.EncryptRuleOnEvidenceRequest(teePubKey, req)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("  Ciphertext: %d bytes (this, not either party's evidence, is what goes on-chain)", len(encryptedEvidence))

	logger.Infof("Sending RULE_ON_EVIDENCE instruction...")
	instructionID, txHash, err := instrutils.SendRuleOnEvidence(testSupport, instructionSenderAddress, encryptedEvidence)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s, tx: %s", instructionID.Hex(), txHash.Hex())
	logger.Infof("  Check that tx's calldata on the explorer: it contains only the %d-byte ciphertext above, never either claimed timestamp.", len(encryptedEvidence))

	time.Sleep(5 * time.Second)

	actionResponse, err := fccutils.ActionResult(*pf, instructionID)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	result := actionResponse.Result

	if result.Status == 0 {
		fccutils.FatalWithCause(errors.Errorf("instruction processing failed: %s", result.Log))
	}
	if result.Status == 2 {
		fccutils.FatalWithCause(errors.New("instruction still pending after polling, expected completed"))
	}
	if len(result.Data) == 0 {
		fccutils.FatalWithCause(errors.New("expected response data but got none"))
	}
	if len(actionResponse.Signature) == 0 {
		fccutils.FatalWithCause(errors.New("expected a TEE signature on the result but got none"))
	}

	decoded, err := verdictArgs.Unpack(result.Data)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("abi.decode(data, (uint256,bool,uint64)) failed: %s (data=0x%x)", err, result.Data))
	}
	decodedEscrowID := decoded[0].(*big.Int).Uint64()
	decodedOutcome := decoded[1].(bool)
	decodedRuling := decoded[2].(uint64)

	logger.Infof("Verdict: escrowId=%d outcome=%v rulingNumber=%d (TEE-signed, not yet submitted on-chain)", decodedEscrowID, decodedOutcome, decodedRuling)

	out := disputeVerdictOutput{
		TeeID:             teeID.Hex(),
		InstructionID:     instructionID.Hex(),
		SubmissionTag:     string(result.SubmissionTag),
		Status:            result.Status,
		DataHex:           "0x" + hex.EncodeToString(result.Data),
		SignatureHex:      "0x" + hex.EncodeToString(actionResponse.Signature),
		DecodedEscrowID:   decodedEscrowID,
		DecodedOutcome:    decodedOutcome,
		DecodedRulingNum:  decodedRuling,
		InstructionTxHash: txHash.Hex(),
	}

	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	if err := os.WriteFile(*outFile, b, 0o644); err != nil {
		fccutils.FatalWithCause(err)
	}
	fmt.Printf("Wrote verdict + signature to %s\n", *outFile)
}
