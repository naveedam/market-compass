import { useState } from "react";
import { Link } from "react-router-dom";
import { scanShockers, type ShockerResult } from "@/lib/shockers";
import type { UniverseRow } from "@/lib/sheets";

interface Props {
  universe: UniverseRow[];
}

type Tab = "volume" | "price";

export default function ShockersPanel({ universe }: Props) {
  const [results, setResults] = useState<ShockerResult[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<Tab>("volume");

  const runScan = async () => {
    setScanning(true);
    try {
      const scanned = await scanShockers(universe);
      setResults(scanned);
    } finally {
      setScanning(false);
    }
  };

  const filtered = (results ?? []).filter(r =>
    tab === "volume" ? r.isVolumeShocker : r.isPriceShocker
  );

  return (
    <div className="panel overflow-hidden flex flex-col mt-8" style={{ maxHeight: "60vh" }}>

      <div className="panel-header">
        <span>Volume & Price Shockers</span>
        <button
          onClick={runScan}
          disabled={scanning || universe.length === 0}
          className="text-[10px] px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed normal-case tracking-normal"
        >
          {scanning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      <div className="flex gap-2 px-3 py-2 border-b border-border">
        <button
          onClick={() => setTab("volume")}
          className={`text-[11px] px-3 py-1 rounded ${tab === "volume" ? "bg-signal/20 text-signal" : "text-muted-foreground"}`}
        >
          Volume Shockers {results && `(${results.filter(r => r.isVolumeShocker).length})`}
        </button>
        <button
          onClick={() => setTab("price")}
          className={`text-[11px] px-3 py-1 rounded ${tab === "price" ? "bg-signal/20 text-signal" : "text-muted-foreground"}`}
        >
          Price Shockers {results && `(${results.filter(r => r.isPriceShocker).length})`}
        </button>
      </div>

      {results === null && !scanning && (
        <div className="p-6 text-xs text-muted-foreground">
          Scans your current universe ({universe.length} stocks) for unusual volume (≥2x the 20-day average) or price moves (≥5% in a day). Not run automatically — click Run Scan.
        </div>
      )}

      {scanning && (
        <div className="p-6 text-xs text-muted-foreground">
          Scanning {universe.length} stocks...
        </div>
      )}

      {results !== null && !scanning && filtered.length === 0 && (
        <div className="p-6 text-xs text-muted-foreground">
          No {tab === "volume" ? "volume" : "price"} shockers found in this universe right now.
        </div>
      )}

      {filtered.length > 0 && (
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
        >
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Company</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Change</th>
                <th className="px-2 py-2 text-right">Volume</th>
                <th className="px-2 py-2 text-right">Avg Vol (20D)</th>
                <th className="px-2 py-2 text-right">Vol Ratio</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .sort((a, b) =>
                  tab === "volume"
                    ? b.volumeRatio - a.volumeRatio
                    : Math.abs(b.changePct) - Math.abs(a.changePct)
                )
                .map(r => (
                  <tr key={r.ticker} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-1.5">
                      <Link to={`/stock/${encodeURIComponent(r.ticker)}`} className="font-semibold text-signal hover:brightness-125">
                        {r.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">{r.ticker}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right ticker-value">₹{r.price.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 text-right ticker-value ${r.changePct >= 0 ? "price-up" : "price-down"}`}>
                      {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1.5 text-right ticker-value">{r.volume.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right ticker-value text-muted-foreground">{r.avgVolume.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right ticker-value font-semibold text-signal">{r.volumeRatio}x</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
