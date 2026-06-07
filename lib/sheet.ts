const CACHE_TTL = 60_000;

let cachedCsv: string | null = null;
let cachedAt = 0;
let staleCsv: string | null = null;

export async function getFaq(): Promise<string> {
  const now = Date.now();

  if (cachedCsv && now - cachedAt < CACHE_TTL) {
    return cachedCsv;
  }

  const url = process.env.SHEET_CSV_URL;
  if (!url) throw new Error("SHEET_CSV_URL is not set");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csv = await response.text();
    cachedCsv = csv;
    cachedAt = now;
    staleCsv = csv;
    return csv;
  } catch (err) {
    console.error("[sheet] fetch failed:", err);
    if (staleCsv) {
      console.warn("[sheet] using stale cache");
      return staleCsv;
    }
    throw err;
  }
}
