import { fetchFundamentals } from "./yahoo";

// ---------------------------------------------------------------------
// Educational Shariah screen — two gates:
//   1. Business activity screen (sector + a small set of known company
//      overrides) — a hard gate; failing this means excluded regardless
//      of ratios.
//   2. Financial ratio screen — 5 rules, computed from live financial
//      data, for stocks that pass gate 1.
//
// This is a simplified, best-effort implementation built on free Yahoo
// Finance data — it is NOT a substitute for a certified Shariah board
// review. Treat results as educational, not a fatwa or investment
// advice.
//
// Data-quality caveats (documented, not hidden):
//   - "Secured + Unsecured Debt" is approximated with Yahoo's single
//     aggregate totalDebt figure — Yahoo doesn't expose the split
//     Indian filings show.
//   - Missing data defaults to 0, which can make a rule look passed
//     when it's actually just unmeasured. failedRules only reflects
//     rules that were positively violated with the data available.
//   - The Sector field from the Sheet is a broad industry label (e.g.
//     "FMCG") and can't by itself distinguish a company whose core
//     business includes a non-permissible activity from others sharing
//     the same label. PROHIBITED_TICKERS below is a narrow, explicit
//     override for known cases the sector label can't catch — not a
//     general classification system. Revisit if the universe expands
//     beyond the current Nifty 50 list.
// ---------------------------------------------------------------------

const PROHIBITED_SECTORS = ["Banking", "Insurance", "Financial Services"];

// Company-level overrides for primary business activities the Sheet's
// broad Sector label doesn't capture.
const PROHIBITED_TICKERS: Record<string, string> = {
  "ITC.NS": "Primary business includes tobacco/cigarette manufacturing",
};

const MIN_MARKET_CAP = 300_000_000; // ₹30 Cr, in INR
const DEBT_TO_EQUITY_THRESHOLD = 0.33;
const DEBT_TO_MARKET_CAP_THRESHOLD = 0.33;
const INTEREST_TO_SALES_THRESHOLD = 0.05;
const RECEIVABLES_TO_MARKET_CAP_THRESHOLD = 0.33;

export interface ShariahResult {
  compliant: boolean;
  // false when we couldn't get real financial data (Yahoo auth/rate
  // limit/timeout) — distinct from a genuine rule failure. The UI
  // should show a "Data Unavailable" state for these, not "Excluded",
  // since compliant:false here reflects "unknown", not "screened out".
  dataAvailable: boolean;
  // false when the business-activity gate excluded the stock before
  // any ratio was computed — the ratio fields below are all 0 and
  // meaningless in that case, not real measured values.
  ratiosComputed: boolean;
  marketCap: number;
  debtToEquity: number;
  debtToMarketCap: number;
  interestToSales: number;
  receivablesToMarketCap: number;
  failedRules: string[];
}

function excludedByBusinessScreen(reason: string): ShariahResult {
  return {
    compliant: false,
    dataAvailable: true, // this is a definitive verdict, not a data gap
    ratiosComputed: false,
    marketCap: 0,
    debtToEquity: 0,
    debtToMarketCap: 0,
    interestToSales: 0,
    receivablesToMarketCap: 0,
    failedRules: [reason],
  };
}

function unavailableResult(reason: string): ShariahResult {
  // Financial data couldn't be retrieved — default to non-compliant
  // rather than silently passing a stock we couldn't actually screen,
  // but flag dataAvailable so the UI can distinguish this from a real
  // rule failure.
  return {
    compliant: false,
    dataAvailable: false,
    ratiosComputed: false,
    marketCap: 0,
    debtToEquity: 0,
    debtToMarketCap: 0,
    interestToSales: 0,
    receivablesToMarketCap: 0,
    failedRules: [reason],
  };
}

/**
 * Runs the full Shariah screen for a single stock: business-activity
 * gate first (sector + known overrides), then the 5-rule ratio screen
 * for whatever passes it.
 */
export async function screenShariahCompliance(
  ticker: string,
  sector: string
): Promise<ShariahResult> {
  if (PROHIBITED_SECTORS.includes(sector)) {
    return excludedByBusinessScreen(
      `Sector "${sector}" is not a permissible business activity`
    );
  }

  if (ticker in PROHIBITED_TICKERS) {
    return excludedByBusinessScreen(PROHIBITED_TICKERS[ticker]);
  }

  let f;
  try {
    f = await fetchFundamentals(ticker);
  } catch (err) {
    return unavailableResult("Financial data unavailable");
  }

  const failedRules: string[] = [];

  // Rule 1: Market Capitalization > ₹30 Cr
  if (f.marketCap <= MIN_MARKET_CAP) {
    failedRules.push(
      `Market cap ₹${(f.marketCap / 1e7).toFixed(1)} Cr is at or below the ₹30 Cr minimum`
    );
  }

  // Rule 2: Debt to Equity < 0.33
  if (f.debtToEquity >= DEBT_TO_EQUITY_THRESHOLD) {
    failedRules.push(
      `Debt/Equity is ${f.debtToEquity.toFixed(2)} (limit 0.33)`
    );
  }

  // Rule 3: (Secured Debt + Unsecured Debt) / Market Cap < 0.33
  const debtToMarketCap = f.marketCap > 0 ? f.totalDebt / f.marketCap : 0;
  if (debtToMarketCap >= DEBT_TO_MARKET_CAP_THRESHOLD) {
    failedRules.push(
      `Debt/Market cap is ${(debtToMarketCap * 100).toFixed(1)}% (limit 33%)`
    );
  }

  // Rule 4: Interest Income / Sales < 0.05
  const interestToSales =
    f.totalRevenue > 0 ? f.interestIncome / f.totalRevenue : 0;
  if (interestToSales >= INTEREST_TO_SALES_THRESHOLD) {
    failedRules.push(
      `Interest income/Sales is ${(interestToSales * 100).toFixed(1)}% (limit 5%)`
    );
  }

  // Rule 5: Trade Receivables / Market Cap < 0.33
  const receivablesToMarketCap =
    f.marketCap > 0 ? f.netReceivables / f.marketCap : 0;
  if (receivablesToMarketCap >= RECEIVABLES_TO_MARKET_CAP_THRESHOLD) {
    failedRules.push(
      `Trade receivables/Market cap is ${(receivablesToMarketCap * 100).toFixed(1)}% (limit 33%)`
    );
  }

  return {
    compliant: failedRules.length === 0,
    dataAvailable: true,
    ratiosComputed: true,
    marketCap: f.marketCap,
    debtToEquity: f.debtToEquity,
    debtToMarketCap,
    interestToSales,
    receivablesToMarketCap,
    failedRules,
  };
}
