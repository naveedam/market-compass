import { useState } from "react";
import StockScreener from "@/components/StockScreener";
import AddStockPanel from "@/components/search/AddStockPanel";

export default function Index() {
  const [shariahOnly, setShariahOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="min-h-screen bg-[#030B1A] text-white">
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <h1 className="text-5xl font-bold">MarketCompass</h1>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-slate-400">Universe</span>
          <button
            onClick={() => setShariahOnly(false)}
            className={`px-3 py-1 rounded-lg text-sm ${!shariahOnly ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            Nifty 50
          </button>
          <button
            onClick={() => setShariahOnly(true)}
            className={`px-3 py-1 rounded-lg text-sm ${shariahOnly ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            Shariah
          </button>
        </div>
          <p className="mt-3 text-lg text-slate-400">
            Educational Multi-Timeframe Market Analysis
          </p>
        </div>

        <AddStockPanel onAdded={() => setRefreshKey(k => k + 1)} />

        <StockScreener key={refreshKey} shariahOnly={shariahOnly} />

        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold mb-5">
            Understanding the Learning Phases
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            <div className="rounded-xl bg-slate-800 p-4">
              <div className="text-cyan-400 font-semibold mb-2">
                Developing
              </div>
              <p className="text-sm text-slate-300 leading-6">
                Price structure is still forming. Momentum and trend alignment
                are incomplete.
              </p>
            </div>

            <div className="rounded-xl bg-slate-800 p-4">
              <div className="text-amber-400 font-semibold mb-2">
                Building
              </div>
              <p className="text-sm text-slate-300 leading-6">
                Several technical characteristics are improving together.
                Study how leadership begins to emerge.
              </p>
            </div>

            <div className="rounded-xl bg-slate-800 p-4">
              <div className="text-emerald-400 font-semibold mb-2">
                High Alignment
              </div>
              <p className="text-sm text-slate-300 leading-6">
                Multiple timeframes show strong agreement. This is an
                educational observation, not a recommendation.
              </p>
            </div>

          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <p className="text-xs text-slate-500 leading-6">
              <span className="font-semibold text-slate-300">
                Educational Use Only.
              </span>{" "}
              MarketCompass helps learners understand market structure,
              momentum and trend behaviour. It does not provide investment
              advice, stock recommendations or trading signals.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
