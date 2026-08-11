// Queries Open-Meteo live for the current temperature at the demo location,
// then picks a threshold guaranteed to be met right now (so the "happy path"
// actually completes within this session) — same spirit as Task 1 picking a
// real XRPL payment that had actually happened, not a mocked one.
import { OPEN_METEO_URL, buildWeatherQueryParams, savePhase2State } from "./config.mjs";

async function main() {
  const params = new URLSearchParams(buildWeatherQueryParams());
  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  console.log("GET", url);
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Open-Meteo returned ${response.status}`);
  }
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  const currentTempC = data.current.temperature_2m;
  const currentTempCx100 = Math.round(currentTempC * 100);

  // Threshold set 4°C below the current reading — comfortably true right
  // now, but not a trivially-always-true value like 0.
  const thresholdTemperatureCx100 = currentTempCx100 - 400;

  console.log(`\nCurrent temperature: ${currentTempC}°C (x100 = ${currentTempCx100})`);
  console.log(`Condition threshold: temperature > ${thresholdTemperatureCx100 / 100}°C`);
  console.log(`Currently satisfied: ${currentTempCx100 > thresholdTemperatureCx100}`);

  await savePhase2State({
    currentTempC,
    currentTempCx100,
    thresholdTemperatureCx100,
    triggerIfAbove: true,
  });
  console.log("\nSaved to state.phase2.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
