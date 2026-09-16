import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadUniverse } from "@/lib/sheets";
import { screenUniverse, type StockSignal } from "@/lib/marketEngine";
import type { ShariahResult } from "@/lib/shariah";

interface Props {
  shariahOnly?: boolean;
}

export default function StockScreener({ shariahOnly = false }: Props) {
  const [stocks, setStocks] = useState<StockSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sheetUniverse = await loadUniverse();
      const results = await screenUniverse(sheetUniverse);
      setStocks(results);
      setLoading(false);
    })();
  }, []);

  if (loading)
    return <div className="p-8 text-slate-400">Scanning NSE universe...</div>;

  const score = (s: StockSignal) => {
    let x = 0;
    if (s.rsiDaily > 60) x += 25;
    else if (s.rsiDaily > 50) x += 15;

    if (s.macdDaily) x += 25;

    if (s.high52Distance > 95) x += 25;
    else if (s.high52Distance > 85) x += 15;

    if (s.adx) x += 5;
    if (s.supertrend) x += 5;

    return Math.min(100, x);
  };

  const status = (v: number) => {
    if (v >= 70)
      return {
        label: "High Alignment",
        cls: "bg-emerald-600 text-white",
        tip: "Daily, weekly and monthly momentum are strongly aligned. Educational observation only."
      };

    if (v >= 40)
      return {
        label: "Building",
        cls: "bg-amber-500 text-black",
        tip: "Multiple technical characteristics are improving, but the overall structure is still developing."
      };

    return {
      label: "Developing",
      cls: "text-slate-400",
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

  const aligned = visibleStocks.filter(s => score(s) >= 70).length;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-3 gap-4">

        <div className="bg-slate-900 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Universe</p>
          <h2 className="text-3xl font-bold">{visibleStocks.length}</h2>
        </div>

        <div className="bg-emerald-950 rounded-xl p-5">
          <p className="text-emerald-300 text-sm">High Alignment</p>
          <h2 className="text-3xl font-bold">{aligned}</h2>
        </div>

        <div className="bg-slate-900 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Last Updated</p>
          <h2 className="text-lg font-semibold">
            {new Date().toLocaleTimeString()}
          </h2>
        </div>

      </div>

      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">

        <table className="w-full">

          <thead className="bg-slate-900">
            <tr className="text-left text-slate-400 text-sm">

              <th className="p-3">Company</th>

              <th title="Learning Score combines RSI, MACD, proximity to the 52-week high and trend structure into a 0–100 educational metric.">
                Score ⓘ
              </th>

              <th>Price</th>

              <th title="Current price as a percentage of the 52-week high. Higher values indicate greater proximity to the yearly high.">
                52W% ⓘ
              </th>

              <th title="Relative Strength Index measures momentum on a scale from 0 to 100.">
                RSI ⓘ
              </th>

              <th title="Educational interpretation of the current market structure.">
                Status ⓘ
              </th>

              <th title="Educational, ratio-based Shariah screen: market cap, debt/equity, debt/market cap, interest income/sales and receivables/market cap. Hover a badge for the breakdown.">
                Shariah ⓘ
              </th>

            </tr>
          </thead>

          <tbody>

            {visibleStocks.map(s => {
              const sc = score(s);
              const st = status(sc);

              return (
                <tr
                  key={s.ticker}
                  className="border-t border-slate-800 hover:bg-slate-900/60"
                >

                  <td className="p-3">
                    <Link
                      to={`/stock/${encodeURIComponent(s.ticker)}`}
                      className="font-semibold text-sky-400 hover:text-sky-300"
                    >
                      {s.name}
                    </Link>

                    <div className="text-xs text-slate-500">
                      {s.ticker}
                    </div>
                  </td>

                  <td>
                    <div className="flex items-center gap-2">

                      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400"
                          style={{ width: `${sc}%` }}
                        />
                      </div>

                      <span className="font-semibold w-8">{sc}</span>

                    </div>
                  </td>

                  <td>₹{s.price.toFixed(2)}</td>

                  <td>{s.high52Distance.toFixed(1)}%</td>

                  <td>{s.rsiDaily.toFixed(1)}</td>

                  <td>
                    <span
                      title={st.tip}
                      className={`px-2 py-1 rounded text-xs font-semibold ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>

                  <td>
                    <span
                      title={shariahTooltip(s.shariah)}
                      className={`px-2 py-1 rounded text-xs font-semibold cursor-help ${
                        !s.shariah.dataAvailable
                          ? "bg-amber-950 text-amber-300"
                          : s.shariah.compliant
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {!s.shariah.dataAvailable
                        ? "Data Unavailable"
                        : s.shariah.compliant
                        ? "Compliant"
                        : "Excluded"}
                    </span>
                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-xs text-slate-400 leading-6">
          <span className="font-semibold text-slate-300">
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
