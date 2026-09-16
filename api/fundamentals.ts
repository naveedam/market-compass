import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-side proxy for Yahoo Finance fundamentals (quoteSummary),
// including the cookie + crumb handshake that endpoint now requires.
// Without it, Yahoo rejects every request with 401 "Invalid Crumb" —
// this is a widely-documented change to Yahoo's unofficial API, not
// specific to this deployment or this project's request pattern.
//
// The cookie + crumb are cached at module scope so a warm serverless
// instance reuses them across requests instead of re-handshaking Yahoo
// on every single stock — with ~50 stocks per page load, re-handshaking
// per request would roughly triple our Yahoo traffic. Cache is dropped
// and re-fetched on the next request whenever a handshake or a 401
// happens, so a stale/rejected crumb doesn't get reused indefinitely.
interface YahooAuth {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

let cachedAuth: YahooAuth | null = null;
const AUTH_TTL_MS = 25 * 60 * 1000;

async function fetchSessionCookie(): Promise<string> {
  // fc.yahoo.com is the standard, widely-used source for this cookie.
  // Falls back to finance.yahoo.com directly if that doesn't yield one
  // (Yahoo's exact flow has shifted before and may again).
  const attempts = ["https://fc.yahoo.com/", "https://finance.yahoo.com/"];

  for (const url of attempts) {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      return setCookie.split(";")[0];
    }
  }

  throw new Error("Yahoo did not return a session cookie from any known endpoint");
}

async function getYahooAuth(): Promise<YahooAuth> {
  if (cachedAuth && Date.now() - cachedAuth.fetchedAt < AUTH_TTL_MS) {
    return cachedAuth;
  }

  const cookie = await fetchSessionCookie();

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Cookie: cookie,
    },
  });

  if (!crumbRes.ok) {
    throw new Error(`Crumb request failed with status ${crumbRes.status}`);
  }

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.toLowerCase().includes("<html")) {
    throw new Error("Yahoo did not return a usable crumb");
  }

  cachedAuth = { cookie, crumb, fetchedAt: Date.now() };
  return cachedAuth;
}

const FUNDAMENTALS_TIMEOUT_MS = 6000;

function timeoutAfter(ms: number): Promise<{ timedOut: true }> {
  return new Promise(resolve => {
    setTimeout(() => resolve({ timedOut: true }), ms);
  });
}

async function fetchQuoteSummary(symbol: string) {
  const auth = await getYahooAuth();

  const modules = "price,financialData,incomeStatementHistory,balanceSheetHistory";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Cookie: auth.cookie,
    },
  });

  const rawBody = await res.text();
  return { status: res.status, ok: res.ok, rawBody };
}

async function fetchTimeseries(symbol: string, auth: YahooAuth) {
  // The quoteSummary balanceSheetHistory/incomeStatementHistory modules
  // return no real line items for receivables or interest income on
  // this symbol (confirmed empirically) — Yahoo's own site now sources
  // that detail from this separate timeseries endpoint instead. Field
  // names here aren't fully confirmed, so several plausible candidates
  // are requested together; unknown keys are silently dropped by Yahoo
  // rather than causing an error, so this is safe to over-request.
  const candidateKeys = [
    "annualNetReceivables",
    "annualAccountsReceivable",
    "annualReceivables",
    "annualInterestIncome",
    "annualInterestExpense",
  ];
  const url =
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=${candidateKeys.join(",")}` +
    `&period1=1420070400&period2=${Math.floor(Date.now() / 1000)}` +
    `&crumb=${encodeURIComponent(auth.crumb)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Cookie: auth.cookie,
    },
  });

  const rawBody = await res.text();
  return { ok: res.ok, rawBody };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const symbol = req.query.symbol;

    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Missing symbol query param" });
      return;
    }

    const outcome = await Promise.race([
      fetchQuoteSummary(symbol).then(r => ({ timedOut: false as const, ...r })),
      timeoutAfter(FUNDAMENTALS_TIMEOUT_MS),
    ]).catch(err => ({
      timedOut: false as const,
      authError: (err as Error).message,
    }));

    if ("timedOut" in outcome && outcome.timedOut) {
      res.status(504).json({
        error: `Yahoo Finance did not respond for ${symbol} within ${FUNDAMENTALS_TIMEOUT_MS}ms`,
      });
      return;
    }

    if ("authError" in outcome) {
      // Handshake itself failed — drop the cache so the next request
      // attempts a fresh one instead of reusing something broken.
      cachedAuth = null;
      console.error(`[api/fundamentals] auth error for ${symbol}:`, outcome.authError);
      res.status(503).json({
        error: `Could not authenticate with Yahoo Finance for ${symbol}`,
        detail: outcome.authError,
      });
      return;
    }

    const { status, ok, rawBody } = outcome;

    if (!ok) {
      // A 401 even right after a handshake means the crumb was
      // rejected — drop the cache so we don't keep reusing it.
      if (status === 401) cachedAuth = null;

      res.status(status).json({
        error: `Yahoo Finance returned ${status} for ${symbol}`,
        detail: rawBody.slice(0, 300),
      });
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error(`[api/fundamentals] non-JSON body for ${symbol}:`, rawBody.slice(0, 300));
      res.status(502).json({
        error: `Yahoo Finance returned a non-JSON response for ${symbol}`,
        detail: rawBody.slice(0, 300),
      });
      return;
    }

    let timeseries: unknown = null;
    try {
      const auth = await getYahooAuth();
      const ts = await fetchTimeseries(symbol, auth);
      if (ts.ok) timeseries = JSON.parse(ts.rawBody);
    } catch {
      // Best-effort only — staying null just means the caller falls
      // back to its existing 0 default for receivables/interest income.
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
    res.status(200).json({ ...data, timeseries });
  } catch (err) {
    console.error("[api/fundamentals] unexpected error:", err);
    res.status(500).json({
      error: "Unexpected error in Yahoo Finance fundamentals proxy",
      detail: (err as Error).message,
    });
  }
}
