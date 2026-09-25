import type { YahooCandle } from "./yahoo";

// ---------------------------------------------------------------------
// Swing-trading signal: support/resistance + BUY/SELL/HOLD direction +
// stop-loss/target, all derived from the same RSI/MACD/52W-high scoring
// already computed in marketEngine.ts — this is a presentation layer on
// top of the existing analysis, not a second parallel signal system.
//
// Support/resistance uses a simple swing high/low over a recent lookback
// window (20 trading days, ~1 month) rather than pivot-point math — this
// keeps the methodology transparent and matches "swing trading" framing
// without implying more precision than the underlying data supports.
//
// Stop-loss and target are anchored to these same support/resistance
// levels (not a separate ATR-based formula), so the numbers shown are
// internally consistent with the S/R lines drawn alongside them:
//   BUY  -> stop at support, target at resistance
//   SELL -> stop at resistance, target at support (inverted risk framing)
//
// Educational tool — not investment advice.
// ---------------------------------------------------------------------

const SR_LOOKBACK = 20;
const BUY_SCORE_THRESHOLD = 60;
const SELL_SCORE_THRESHOLD = 30;

export interface SwingSignal {
  direction: "BUY" | "SELL" | "HOLD";
  support: number;
  resistance: number;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  reason: string;
}

export function computeSwingSignal(
  daily: YahooCandle[],
  isBuy: boolean,
  score: number
): SwingSignal {
  const recent = daily.slice(-SR_LOOKBACK);
  const support = Math.min(...recent.map(c => c.low));
  const resistance = Math.max(...recent.map(c => c.high));
  const entry = daily.at(-1)!.close;

  let direction: SwingSignal["direction"] = "HOLD";
  let stopLoss = support;
  let target = resistance;
  let reason = "Price is inside its recent range with no strong directional edge.";

  if (isBuy && score >= BUY_SCORE_THRESHOLD) {
    direction = "BUY";
    stopLoss = support;
    target = resistance;
    const pctToResistance = resistance > entry ? ((entry - support) / (resistance - support) * 100) : 100;
    reason = `Score ${score}/100, ${pctToResistance.toFixed(0)}% of the way from support to resistance — momentum favors continuation toward the recent high.`;
  } else if (!isBuy && score <= SELL_SCORE_THRESHOLD) {
    direction = "SELL";
    stopLoss = resistance;
    target = support;
    reason = `Score ${score}/100 with weakening structure — risk skews toward a retest of the recent low.`;
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target - entry);
  const riskReward = risk > 0 ? +(reward / risk).toFixed(2) : 0;

  return { direction, support, resistance, entry, stopLoss, target, riskReward, reason };
}
