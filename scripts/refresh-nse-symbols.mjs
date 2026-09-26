// Refreshes src/data/nse-symbols.json from NSE's official, public equity
// list. Run with: node scripts/refresh-nse-symbols.mjs
//
// Why this is a script you run, not something hardcoded once: NSE adds
// and removes listings continuously (IPOs, delistings, demergers — see
// the TMPV.NS/TATAMOTORS.NS case earlier in this project). Re-run this
// periodically rather than treating the symbol list as permanent.
//
// Data source: https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv
// This is NSE's own public archive, no login/API key required. It does
// NOT include a sector column — sector data isn't available from this
// source. Symbols already present in the curated list below (your
// Nifty 50 + Next 50) keep their real, verified sector; every other
// symbol gets an empty sector, which is fine for search (it matches on
// symbol/name, not sector) but means "sector" isn't populated for the
// long tail until you have a real source for it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "nse-symbols.json");
const NSE_CSV_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

async function main() {
  console.log(`Fetching ${NSE_CSV_URL} ...`);

  const res = await fetch(NSE_CSV_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`NSE returned ${res.status} — the source may have moved or be temporarily blocking this request.`);
  }

  const csvText = await res.text();
  const lines = csvText.split("\n").filter(l => l.trim().length > 0);

  const header = parseCsvLine(lines[0]);
  const symbolIdx = header.findIndex(h => h.trim().toUpperCase() === "SYMBOL");
  const nameIdx = header.findIndex(h => h.trim().toUpperCase() === "NAME OF COMPANY");

  if (symbolIdx === -1 || nameIdx === -1) {
    throw new Error("Unexpected CSV header shape — NSE may have changed the file format. Check the header row manually before proceeding.");
  }

  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    console.warn("Could not read existing nse-symbols.json — proceeding with no sector overrides.");
  }
  const sectorByTicker = new Map(existing.map(e => [e.ticker, e.sector]));

  const rows = lines.slice(1).map(line => {
    const fields = parseCsvLine(line);
    const symbol = fields[symbolIdx];
    const name = fields[nameIdx];
    if (!symbol || !name) return null;

    const ticker = `${symbol}.NS`;
    return {
      symbol,
      ticker,
      name,
      sector: sectorByTicker.get(ticker) || "",
    };
  }).filter(Boolean);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2) + "\n");

  const withSector = rows.filter(r => r.sector).length;
  console.log(`Wrote ${rows.length} symbols to ${OUTPUT_PATH}`);
  console.log(`${withSector} of those have a known sector (from your existing curated list); ${rows.length - withSector} have an empty sector.`);
}

main().catch(err => {
  console.error("Refresh failed:", err.message);
  process.exit(1);
});
