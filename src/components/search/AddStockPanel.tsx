import { useState } from "react";
import SearchBar from "./SearchBar";
import type { NSESymbol } from "@/lib/search/symbolSearch";
import { addToWatchlist } from "@/lib/watchlist";

interface Props {
  onAdded?: () => void;
}

export default function AddStockPanel({ onAdded }: Props) {
  const [selected, setSelected] = useState<NSESymbol | null>(null);
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleAdd = async () => {
    if (!selected) return;
    setStatus("adding");

    const result = await addToWatchlist(selected);

    if (result.success) {
      setStatus("success");
      setMessage(selected.symbol + " added to your watchlist.");
      setSelected(null);
      onAdded?.();
    } else {
      setStatus("error");
      setMessage(result.error ?? "Failed to add stock.");
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold mb-3">Add a Stock to Your Watchlist</h2>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="flex-1 w-full">
          <SearchBar
            onSelect={(stock) => {
              setSelected(stock);
              setStatus("idle");
            }}
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={!selected || status === "adding"}
          className="px-4 py-3 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === "adding" ? "Adding..." : selected ? "Add " + selected.symbol : "Select a stock"}
        </button>
      </div>

      {status === "success" && (
        <p className="mt-3 text-sm text-emerald-400">{message}</p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{message}</p>
      )}
    </div>
  );
}
