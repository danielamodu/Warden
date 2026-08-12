// Live current-weather read via Open-Meteo (no API key) — same endpoint
// Phase 2's scripts/phase2/config.mjs queries. Used to show a genuinely live
// "current condition reading" for the weather escrow, replacing the old
// static 33.9°C snapshot.
export async function getCurrentTemperatureC(lat: number, lon: number): Promise<number> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo request failed: HTTP ${res.status}`);
  const json = await res.json();
  const temp = json?.current?.temperature_2m;
  if (typeof temp !== 'number') throw new Error('Open-Meteo response missing current.temperature_2m');
  return temp;
}
