import { fetchHistory } from "./yahoo";
import type { UniverseRow } from "./sheets";
import { screenShariahCompliance, type ShariahResult } from "./shariah";

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSignal {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  high52Distance: number;
  rsiDaily: number;
  macdDaily: boolean;
  adx: boolean;
  supertrend: boolean;
  isBuy: boolean;
  shariah: ShariahResult;
}

const RSI_PERIOD = 14;

function rsi(values: number[]) {
  if (values.length < RSI_PERIOD + 1) return 0;

  let gain = 0, loss = 0;

  for (let i = 1; i <= RSI_PERIOD; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }

  let avgGain = gain / RSI_PERIOD;
  let avgLoss = loss / RSI_PERIOD;

  for (let i = RSI_PERIOD + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * 13 + g) / 14;
    avgLoss = (avgLoss * 13 + l) / 14;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  let prev = values[0];
  const out = [prev];

  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }

  return out;
}

function macd(values: number[]) {
  const e12 = ema(values, 12);
  const e26 = ema(values, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const signal = ema(line, 9);
  return line.at(-1)! > signal.at(-1)!;
}

export async function screenUniverse(
  universe: UniverseRow[]
): Promise<StockSignal[]> {

  const results: StockSignal[] = [];

  for (const stock of universe) {
    try {
            const [daily, shariah] = await Promise.all([
        fetchHistory(stock.ticker),
        screenShariahCompliance(stock.ticker, stock.sector),
      ]);

      if (daily.length < 252) continue;

      const closes = daily.map(c => c.close);
      const highs = daily.map(c => c.high);

      const price = closes.at(-1)!;
      const high52 = Math.max(...highs.slice(-252));
      const high52Distance = +(price / high52 * 100).toFixed(1);

      const rsiDaily = rsi(closes);
      const macdDaily = macd(closes);

      const isBuy =
        high52Distance >= 80 &&
        high52Distance <= 98 &&
        rsiDaily > 55 &&
        macdDaily;

      results.push({
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        price,
        high52Distance,
        rsiDaily,
        macdDaily,
        adx: false,
        supertrend: false,
        isBuy,
        shariah,
      });
    } catch (err) {
      console.warn(`Skipping ${stock.ticker}:`, (err as Error).message);
      continue;
    }
  }

  return results;
}
