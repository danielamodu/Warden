// Calls Flare's Web2Json verifier to turn the live Open-Meteo query into an
// abiEncodedRequest the FDC smart contracts understand.
import {
  env,
  WEB2JSON_ATTESTATION_TYPE,
  WEB2JSON_SOURCE_ID,
  WEB2JSON_VERIFIER_PATH,
  OPEN_METEO_URL,
  buildWeatherQueryParams,
  WEATHER_POST_PROCESS_JQ,
  WEATHER_ABI_SIGNATURE,
  toUtf8HexString,
  loadPhase2State,
  savePhase2State,
} from "./config.mjs";

async function main() {
  const state = await loadPhase2State();
  if (!state.escrowId) {
    throw new Error("Missing escrowId in state.phase2.json — run 03-fund-escrow.mjs first.");
  }

  const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET } = env;
  const url = `${VERIFIER_URL_TESTNET}${WEB2JSON_VERIFIER_PATH}`;

  const requestBody = {
    url: OPEN_METEO_URL,
    httpMethod: "GET",
    headers: "{}",
    queryParams: JSON.stringify(buildWeatherQueryParams()),
    body: "{}",
    postProcessJq: WEATHER_POST_PROCESS_JQ,
    abiSignature: WEATHER_ABI_SIGNATURE,
  };

  const request = {
    attestationType: toUtf8HexString(WEB2JSON_ATTESTATION_TYPE),
    sourceId: toUtf8HexString(WEB2JSON_SOURCE_ID),
    requestBody,
  };

  console.log("POST", url);
  console.log("Request:", JSON.stringify(request, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": VERIFIER_API_KEY_TESTNET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Verifier returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.status !== "VALID") {
    throw new Error(`Verifier status was not VALID: ${data.status}`);
  }

  await savePhase2State({ abiEncodedRequest: data.abiEncodedRequest });
  console.log("\nSaved abiEncodedRequest to state.phase2.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
