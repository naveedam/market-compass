import { useState } from "react";
import StockScreener from "@/components/StockScreener";
import AddStockPanel from "@/components/search/AddStockPanel";

export default function Index() {
  const [shariahOnly, setShariahOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <h1 className="text-5xl font-bold terminal-glow">MarketCompass</h1>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Universe</span>
          <button
            onClick={() => setShariahOnly(false)}
            className={`px-3 py-1 rounded-lg text-sm ${!shariahOnly ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            Nifty 50
          </button>
          <button
            onClick={() => setShariahOnly(true)}
            className={`px-3 py-1 rounded-lg text-sm ${shariahOnly ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            Shariah
          </button>
        </div>
          <p className="mt-3 text-lg text-muted-foreground">
            Educational Multi-Timeframe Market Analysis
          </p>
        </div>

        <AddStockPanel onAdded={() => setRefreshKey(k => k + 1)} />

        <StockScreener key={refreshKey} shariahOnly={shariahOnly} />

        <div className="panel p-6 mt-10">
          <h2 className="text-2xl font-semibold mb-5">
            Understanding the Learning Phases
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            <div className="rounded-xl bg-secondary p-4">
              <div className="text-signal font-semibold mb-2">
                Developing
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Price structure is still forming. Momentum and trend alignment
                are incomplete.
              </p>
            </div>

            <div className="rounded-xl bg-secondary p-4">
              <div className="text-warning font-semibold mb-2">
                Building
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Several technical characteristics are improving together.
                Study how leadership begins to emerge.
              </p>
            </div>

            <div className="rounded-xl bg-secondary p-4">
              <div className="text-profit font-semibold mb-2">
                High Alignment
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Multiple timeframes show strong agreement. This is an
                educational observation, not a recommendation.
              </p>
            </div>

          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground leading-6">
              <span className="font-semibold text-foreground">
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
