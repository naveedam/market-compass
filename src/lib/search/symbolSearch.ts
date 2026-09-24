import symbols from "@/data/nse-symbols.json";

export interface NSESymbol {
  symbol: string;
  ticker: string;
  name: string;
  sector: string;
}

const registry = symbols as NSESymbol[];

export function searchSymbols(query: string, limit = 10): NSESymbol[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return registry
    .filter(s =>
      s.symbol.toLowerCase().startsWith(q) ||
      s.name.toLowerCase().includes(q)
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}
