import { useState } from "react";
import { searchSymbols, type NSESymbol } from "@/lib/search/symbolSearch";

interface Props {
  onSelect: (stock: NSESymbol) => void;
}

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const results = searchSymbols(query);

  return (
    <div className="relative w-full">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search any NSE stock..."
        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-white"
      />

      {results.length > 0 && (
        <div className="absolute mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 shadow-xl z-50">
          {results.map((s) => (
            <button
              key={s.ticker}
              onClick={() => {
                onSelect(s);
                setQuery(s.symbol);
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0"
            >
              <div className="font-semibold text-white">{s.symbol}</div>
              <div className="text-xs text-slate-400">{s.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
