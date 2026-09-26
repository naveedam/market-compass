import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadUniverse } from "@/lib/sheets";
import { screenUniverse, type StockSignal } from "@/lib/marketEngine";
import type { ShariahResult } from "@/lib/shariah";
import type { SwingSignal } from "@/lib/swingSignals";

interface Props {
  shariahOnly?: boolean;
}

function DirectionBadge({ direction }: { direction: SwingSignal["direction"] }) {
  const styles = {
    BUY: "bg-profit/20 text-profit",
    SELL: "bg-loss/20 text-loss",
    HOLD: "bg-muted text-muted-foreground",
  } as const;

  const symbol = { BUY: "▲", SELL: "▼", HOLD: "—" } as const;

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-black uppercase tracking-wider ${styles[direction]}`}>
      {symbol[direction]} {direction}
    </span>
  );
}

function swingTooltip(s: SwingSignal): string {
  return [
    `Entry: ₹${s.entry.toFixed(2)}`,
    `Stop-loss: ₹${s.stopLoss.toFixed(2)}`,
    `Target: ₹${s.target.toFixed(2)}`,
    `Risk:Reward: 1:${s.riskReward}`,
    `Support: ₹${s.support.toFixed(2)}  |  Resistance: ₹${s.resistance.toFixed(2)}`,
    "",
    s.reason,
  ].join("\n");
}

type SortKey = "name" | "score" | "price" | "high52Distance" | "rsiDaily";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="text-muted-foreground/40 ml-1">↕</span>;
  return <span className="text-signal ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function StockScreener({ shariahOnly = false }: Props) {
  const [stocks, setStocks] = useState<StockSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  useEffect(() => {
    (async () => {
      const sheetUniverse = await loadUniverse();
      const results = await screenUniverse(sheetUniverse);
      setStocks(results);
      setLoading(false);
    })();
  }, []);

  if (loading)
    return <div className="p-8 text-muted-foreground">Scanning NSE universe...</div>;

  const status = (v: number) => {
    if (v >= 70)
      return {
        label: "High Alignment",
        cls: "bg-profit/20 text-profit",
        tip: "Daily, weekly and monthly momentum are strongly aligned. Educational observation only."
      };

    if (v >= 40)
      return {
        label: "Building",
        cls: "bg-warning/20 text-warning",
        tip: "Multiple technical characteristics are improving, but the overall structure is still developing."
      };

    return {
      label: "Developing",
      cls: "text-muted-foreground",
      tip: "Early stage market structure. The trend and momentum are still forming."
    };
  };

  const shariahTooltip = (r: ShariahResult) => {
    if (!r.ratiosComputed) {
      return r.failedRules[0] ?? (r.dataAvailable ? "Excluded" : "Data unavailable");
    }

    const lines = [
      `Market cap: ₹${(r.marketCap / 1e7).toFixed(1)} Cr (min ₹30 Cr)`,
      `Debt / Equity: ${r.debtToEquity.toFixed(2)} (limit 0.33)`,
      `Debt / Market cap: ${(r.debtToMarketCap * 100).toFixed(1)}% (limit 33%)`,
      `Interest income / Sales: ${(r.interestToSales * 100).toFixed(1)}% (limit 5%)`,
      `Trade receivables / Market cap: ${(r.receivablesToMarketCap * 100).toFixed(1)}% (limit 33%)`,
    ];

    if (r.failedRules.length) lines.push("", `Failed: ${r.failedRules.join("; ")}`);

    return lines.join("\n");
  };

  const visibleStocks = stocks.filter(s => !shariahOnly || s.shariah.compliant);

  const sortedStocks = [...visibleStocks].sort((a, b) => {
    let cmp: number;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else cmp = a[sortKey] - b[sortKey];
    return sortDir === "asc" ? cmp : -cmp;
  });

  const aligned = visibleStocks.filter(s => s.score >= 70).length;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-3 gap-4">

        <div className="panel p-5">
          <p className="text-muted-foreground text-sm">Universe</p>
          <h2 className="text-3xl font-bold ticker-value">{visibleStocks.length}</h2>
        </div>

        <div className="panel p-5 bg-profit/10 border-profit/30">
          <p className="text-profit text-sm">High Alignment</p>
          <h2 className="text-3xl font-bold ticker-value terminal-glow">{aligned}</h2>
        </div>

        <div className="panel p-5">
          <p className="text-muted-foreground text-sm">Last Updated</p>
          <h2 className="text-lg font-semibold ticker-value">
            {new Date().toLocaleTimeString()}
          </h2>
        </div>

      </div>

      <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>

        <div className="panel-header">
          <span>Nifty 50 Watchlist</span>
          <span className="text-[10px]">{visibleStocks.length} stocks · scroll for more</span>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
        >
          <table className="w-full text-xs font-mono">

            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left text-muted-foreground border-b border-border">

                <th className="px-3 py-2 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("name")}>
                  Company<SortIcon active={sortKey === "name"} dir={sortDir} />
                </th>

                <th className="px-2 py-2 cursor-pointer select-none hover:text-foreground" title="Learning Score combines RSI, MACD, proximity to the 52-week high and trend structure into a 0–100 educational metric." onClick={() => toggleSort("score")}>
                  Score ⓘ<SortIcon active={sortKey === "score"} dir={sortDir} />
                </th>

                <th className="px-2 py-2 text-right cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("price")}>
                  Price<SortIcon active={sortKey === "price"} dir={sortDir} />
                </th>

                <th className="px-2 py-2 text-right cursor-pointer select-none hover:text-foreground" title="Current price as a percentage of the 52-week high. Higher values indicate greater proximity to the yearly high." onClick={() => toggleSort("high52Distance")}>
                  52W% ⓘ<SortIcon active={sortKey === "high52Distance"} dir={sortDir} />
                </th>

                <th className="px-2 py-2 text-right cursor-pointer select-none hover:text-foreground" title="Relative Strength Index measures momentum on a scale from 0 to 100." onClick={() => toggleSort("rsiDaily")}>
                  RSI ⓘ<SortIcon active={sortKey === "rsiDaily"} dir={sortDir} />
                </th>

                <th className="px-2 py-2" title="Educational interpretation of the current market structure.">
                  Status ⓘ
                </th>

                <th className="px-2 py-2" title="Educational, ratio-based Shariah screen: market cap, debt/equity, debt/market cap, interest income/sales and receivables/market cap. Hover a badge for the breakdown.">
                  Shariah ⓘ
                </th>

                <th className="px-2 py-2" title="Educational swing-trade read derived from the same score: direction, entry, stop-loss, target and support/resistance. Hover for the breakdown.">
                  Signal ⓘ
                </th>

              </tr>
            </thead>

            <tbody>

              {sortedStocks.map(s => {
                const st = status(s.score);

                return (
                  <tr
                    key={s.ticker}
                    className="border-b border-border/50 hover:bg-secondary/40"
                  >

                    <td className="px-3 py-1.5">
                      <Link
                        to={`/stock/${encodeURIComponent(s.ticker)}`}
                        className="font-semibold text-signal hover:brightness-125"
                      >
                        {s.name}
                      </Link>

                      <div className="text-[10px] text-muted-foreground">
                        {s.ticker}
                      </div>
                    </td>

                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">

                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-signal"
                            style={{ width: `${s.score}%` }}
                          />
                        </div>

                        <span className="font-semibold w-6 ticker-value">{s.score}</span>

                      </div>
                    </td>

                    <td className="px-2 py-1.5 text-right ticker-value">₹{s.price.toFixed(2)}</td>

                    <td className="px-2 py-1.5 text-right ticker-value">{s.high52Distance.toFixed(1)}%</td>

                    <td className="px-2 py-1.5 text-right ticker-value">{s.rsiDaily.toFixed(1)}</td>

                    <td className="px-2 py-1.5">
                      <span
                        title={st.tip}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </td>

                    <td className="px-2 py-1.5">
                      <span
                        title={shariahTooltip(s.shariah)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-help ${
                          !s.shariah.dataAvailable
                            ? "bg-warning/20 text-warning"
                            : s.shariah.compliant
                            ? "bg-profit/20 text-profit"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {!s.shariah.dataAvailable
                          ? "Data Unavailable"
                          : s.shariah.compliant
                          ? "Compliant"
                          : "Excluded"}
                      </span>
                    </td>

                    <td className="px-2 py-1.5">
                      <span title={swingTooltip(s.swing)} className="cursor-help">
                        <DirectionBadge direction={s.swing.direction} />
                      </span>
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>
        </div>

      </div>

      <div className="panel p-4">
        <p className="text-xs text-muted-foreground leading-6">
          <span className="font-semibold text-foreground">
            Educational Use Only.
          </span>{" "}
          MarketCompass is designed to help users learn technical market analysis.
          It does not provide investment advice, stock recommendations, or trading
          signals.
        </p>
      </div>

    </div>
  );
}
