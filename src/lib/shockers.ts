import { fetchHistory } from "./yahoo";
import type { UniverseRow } from "./sheets";

// ---------------------------------------------------------------------
// Volume & price "shockers" — stocks with an unusual move today relative
// to their own recent history. Reuses the same OHLCV data /api/yahoo
// already serves for the main screener; no new data source or API.
//
// This is a separate, user-triggered scan rather than something that
// runs automatically on page load. Given the whole day spent getting
// Yahoo access stable at ~49 stocks, silently doubling request volume
// on every visit by auto-scanning a second, larger universe would
// reintroduce that exact risk. A button keeps it opt-in.
//
// Definitions (standard, simple, transparent — not proprietary):
//   Volume shocker: today's volume vs. the 20-day average volume.
//   Price shocker:  today's % change vs. yesterday's close.
// Educational tool — not investment advice.
// ---------------------------------------------------------------------

const VOLUME_LOOKBACK = 20;
const VOLUME_RATIO_THRESHOLD = 2; // today's volume >= 2x the 20-day average
const PRICE_MOVE_THRESHOLD = 5; // |% change| >= 5%

export interface ShockerResult {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  isVolumeShocker: boolean;
  isPriceShocker: boolean;
}

export async function scanShockers(
  universe: UniverseRow[]
): Promise<ShockerResult[]> {
  const results: ShockerResult[] = [];

  for (const stock of universe) {
    try {
      const daily = await fetchHistory(stock.ticker);

      if (daily.length < VOLUME_LOOKBACK + 1) continue;

      const today = daily.at(-1)!;
      const yesterday = daily.at(-2)!;

      const recentVolumes = daily.slice(-1 - VOLUME_LOOKBACK, -1).map(c => c.volume);
      const avgVolume =
        recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;

      const volumeRatio = avgVolume > 0 ? +(today.volume / avgVolume).toFixed(2) : 0;
      const changePct = yesterday.close > 0
        ? +(((today.close - yesterday.close) / yesterday.close) * 100).toFixed(2)
        : 0;

      results.push({
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        price: today.close,
        changePct,
        volume: today.volume,
        avgVolume: Math.round(avgVolume),
        volumeRatio,
        isVolumeShocker: volumeRatio >= VOLUME_RATIO_THRESHOLD,
        isPriceShocker: Math.abs(changePct) >= PRICE_MOVE_THRESHOLD,
      });
    } catch (err) {
      console.warn(`Skipping ${stock.ticker} in shocker scan:`, (err as Error).message);
      continue;
    }
  }

  return results;
}
