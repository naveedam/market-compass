export type UniverseRow = {
  ticker: string;
  name: string;
  sector: string;
};

const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxeNBCliwCOCOi0BzTE2H1HCNaGmgkssrrACDQLd-NGF1symVO7cIqw5rXpwAf0wdhs/exec";

export async function loadUniverse(): Promise<UniverseRow[]> {
  const res = await fetch(SHEET_URL);
  const data = await res.json();

  return data.map((r: any) => ({
    ticker: r.ticker ?? r.symbol ?? r.Symbol,
    name: r.name ?? r.Name,
    sector: r.sector ?? r.Sector,
  }));
}
