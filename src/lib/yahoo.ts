export interface YahooCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistory(symbol: string): Promise<YahooCandle[]> {
  const res = await fetch(`/api/yahoo?symbol=${encodeURIComponent(symbol)}`);

  if (!res.ok) throw new Error(`Failed to fetch ${symbol}`);

  const json = await res.json();
  const result = json.chart?.result?.[0];

  if (!result) throw new Error(`No Yahoo data for ${symbol}`);

  const q = result.indicators.quote[0];

  return result.timestamp.map((t: number, i: number) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: q.open[i],
    high: q.high[i],
    low: q.low[i],
    close: q.close[i],
    volume: q.volume[i]
  })).filter((c: YahooCandle) => c.close != null);
}

export interface Fundamentals {
  marketCap: number;
  // Yahoo returns debtToEquity as a percentage (e.g. 45.2 meaning
  // 45.2%), not a raw ratio — normalized to a ratio here (0.452).
  debtToEquity: number;
  // Yahoo only exposes an aggregate "totalDebt", not the
  // secured/unsecured split Indian filings show — used as a
  // best-effort stand-in for (Secured + Unsecured Debt).
  totalDebt: number;
  totalRevenue: number;
  // Best-effort: many companies don't report a dedicated "interest
  // income" line in the free Yahoo feed. Defaults to 0 when absent
  // rather than guessing — see shariah.ts for how this affects the
  // ratio.
  interestIncome: number;
  // Trade receivables, from the balance sheet.
  netReceivables: number;
}

function extractTimeseriesValue(timeseries: any, candidateKeys: string[]): number {
  const results = timeseries?.timeseries?.result;
  if (!Array.isArray(results)) return 0;

  for (const key of candidateKeys) {
    for (const entry of results) {
      const series = entry?.[key];
      if (!Array.isArray(series)) continue;
      for (const point of series) {
        const raw = point?.reportedValue?.raw ?? point?.raw;
        if (typeof raw === "number") return raw;
      }
    }
  }
  return 0;
}

export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);

  if (!res.ok) throw new Error(`Failed to fetch fundamentals for ${symbol}`);

  const json = await res.json();
  const result = json.quoteSummary?.result?.[0];

  if (!result) throw new Error(`No fundamentals data for ${symbol}`);

  const price = result.price ?? {};
  const fin = result.financialData ?? {};

  return {
    marketCap: price.marketCap?.raw ?? 0,
    debtToEquity: (fin.debtToEquity?.raw ?? 0) / 100,
    totalDebt: fin.totalDebt?.raw ?? 0,
    totalRevenue: fin.totalRevenue?.raw ?? 0,
    interestIncome: extractTimeseriesValue(json.timeseries, [
      "annualInterestIncome",
      "annualInterestExpense",
    ]),
    netReceivables: extractTimeseriesValue(json.timeseries, [
      "annualNetReceivables",
      "annualAccountsReceivable",
      "annualReceivables",
    ]),
  };
}
