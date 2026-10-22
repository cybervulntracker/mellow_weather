// One fetch wrapper for every outside API: timeout, polite User-Agent, JSON, clear errors.
const USER_AGENT = `MellowWeather/1.0 (${process.env.CONTACT_EMAIL || "student project"})`;

async function getJson(url, timeoutMs = 8000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
}

module.exports = { getJson };
