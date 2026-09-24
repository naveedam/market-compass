import type { NSESymbol } from "./search/symbolSearch";

// Same Apps Script Web App that already serves reads for the Watchlist
// sheet (see sheets.ts) — this just adds a write via doPost.
const WATCHLIST_URL =
  "https://script.google.com/macros/s/AKfycbz7Xf29mRvH30K8N2_G6T5mkdZPNQ1UtDDZw8CbJFzn2liEEnqjcZzUua_Um5DPxVTN/exec";

// Basic deterrent against casual/accidental spam — NOT real security.
// Must match WRITE_SECRET in the Apps Script exactly. See that file's
// comment for why this isn't a real auth boundary.
const WATCHLIST_SECRET = import.meta.env.VITE_WATCHLIST_SECRET as string;

export interface AddResult {
  success: boolean;
  error?: string;
}

export async function addToWatchlist(stock: NSESymbol): Promise<AddResult> {
  try {
    const res = await fetch(WATCHLIST_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight that Apps Script doesn't
      // handle by default; the body is still JSON, parsed server-side
      // from e.postData.contents regardless of the declared type.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: WATCHLIST_SECRET,
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
      }),
    });

    // Apps Script always returns HTTP 200 -- check the JSON body for
    // an "error" key, never res.status, for this endpoint.
    const json = await res.json();

    if (json.error) {
      return { success: false, error: json.error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
