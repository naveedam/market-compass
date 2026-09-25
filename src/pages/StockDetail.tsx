import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchHistory } from "@/lib/yahoo";
import { rsi, macd, computeScore } from "@/lib/marketEngine";
import { computeSwingSignal, type SwingSignal } from "@/lib/swingSignals";

type Candle = {
  date:string;
  open:number;
  high:number;
  low:number;
  close:number;
  volume:number;
};

function DirectionBadge({ direction }: { direction: SwingSignal["direction"] }) {
  const styles = {
    BUY: "bg-profit/20 text-profit border-profit/40",
    SELL: "bg-loss/20 text-loss border-loss/40",
    HOLD: "bg-muted text-muted-foreground border-border",
  } as const;

  const symbol = { BUY: "▲", SELL: "▼", HOLD: "—" } as const;

  return (
    <span className={`text-sm px-3 py-1.5 rounded-lg font-mono font-black uppercase tracking-wider border ${styles[direction]}`}>
      {symbol[direction]} {direction}
    </span>
  );
}

export default function StockDetail(){
  const { ticker="" } = useParams();
  const [rows,setRows] = useState<Candle[]>([]);
  const [tf,setTf] = useState<"D"|"W"|"M">("D");

  useEffect(()=>{
    fetchHistory(ticker).then(setRows).catch(console.error);
  },[ticker]);

  const weekly=(c:Candle[])=>{
    const m=new Map<string,Candle[]>();
    c.forEach(r=>{
      const d=new Date(r.date);
      const k=`${d.getFullYear()}-${d.getMonth()}-${Math.floor((d.getDate()-1)/7)}`;
      if(!m.has(k)) m.set(k,[]);
      m.get(k)!.push(r);
    });
    return [...m.values()].map(g=>({
      date:g.at(-1)!.date,
      open:g[0].open,
      high:Math.max(...g.map(x=>x.high)),
      low:Math.min(...g.map(x=>x.low)),
      close:g.at(-1)!.close,
      volume:g.reduce((a,b)=>a+b.volume,0)
    }));
  };

  const monthly=(c:Candle[])=>{
    const m=new Map<string,Candle[]>();
    c.forEach(r=>{
      const d=new Date(r.date);
      const k=`${d.getFullYear()}-${d.getMonth()}`;
      if(!m.has(k)) m.set(k,[]);
      m.get(k)!.push(r);
    });
    return [...m.values()].map(g=>({
      date:g.at(-1)!.date,
      open:g[0].open,
      high:Math.max(...g.map(x=>x.high)),
      low:Math.min(...g.map(x=>x.low)),
      close:g.at(-1)!.close,
      volume:g.reduce((a,b)=>a+b.volume,0)
    }));
  };

  const data = useMemo(()=>{
    if(tf==="D") return rows;
    if(tf==="W") return weekly(rows);
    return monthly(rows);
  },[rows,tf]);

  const current=data.at(-1)?.close??0;
  const high=rows.length?Math.max(...rows.map(r=>r.high)):0;
  const low=rows.length?Math.min(...rows.map(r=>r.low)):0;

  const min=Math.min(...data.map(x=>x.close),current);
  const max=Math.max(...data.map(x=>x.close),current);

  const points=data.map((c,i)=>{
    const x=20+i*(780/Math.max(1,data.length-1));
    const y=240-((c.close-min)/(max-min||1))*200;
    return `${x},${y}`;
  }).join(" ");

  const trend=current>=data[0]?.close;

  const signal = useMemo(() => {
    if (rows.length < 252) return null;

    const closes = rows.map(c => c.close);
    const highs = rows.map(c => c.high);
    const price = closes.at(-1)!;
    const high52 = Math.max(...highs.slice(-252));
    const high52Distance = +(price / high52 * 100).toFixed(1);
    const rsiDaily = rsi(closes);
    const macdDaily = macd(closes);
    const isBuy = high52Distance >= 80 && high52Distance <= 98 && rsiDaily > 55 && macdDaily;
    const score = computeScore({ rsiDaily, macdDaily, high52Distance, adx: false, supertrend: false });

    return computeSwingSignal(rows, isBuy, score);
  }, [rows]);

  const srY = (price: number) => 240 - ((price - min) / (max - min || 1)) * 200;

  return(
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-8">

        <Link to="/" className="text-signal text-sm">
          ← Back to MarketCompass
        </Link>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <h1 className="text-5xl font-bold ticker-value">{ticker}</h1>
          {signal && <DirectionBadge direction={signal.direction} />}
        </div>

        <p className="text-muted-foreground mt-2">
          Educational Market Structure Explorer
        </p>

        {signal && signal.direction !== "HOLD" && (
          <div className="signal-card mt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Educational Swing Signal
              </div>
              <DirectionBadge direction={signal.direction} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Entry</div>
                <div className="text-xl font-bold ticker-value mt-1">₹{signal.entry.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Stop-Loss</div>
                <div className="text-xl font-bold ticker-value text-loss mt-1">₹{signal.stopLoss.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Target</div>
                <div className="text-xl font-bold ticker-value text-profit mt-1">₹{signal.target.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Risk:Reward</div>
                <div className="text-xl font-bold ticker-value mt-1">1:{signal.riskReward}</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground leading-6">
              {signal.reason}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">

          <div className="panel p-5">
            <div className="text-muted-foreground text-sm">Current Price</div>
            <div className="text-3xl font-bold ticker-value mt-1">₹{current.toFixed(2)}</div>
          </div>

          <div className="panel p-5">
            <div className="text-muted-foreground text-sm">2Y High</div>
            <div className="text-3xl font-bold ticker-value mt-1">₹{high.toFixed(0)}</div>
          </div>

          <div className="panel p-5">
            <div className="text-muted-foreground text-sm">2Y Low</div>
            <div className="text-3xl font-bold ticker-value mt-1">₹{low.toFixed(0)}</div>
          </div>

          <div className="panel p-5">
            <div className="text-muted-foreground text-sm">Observations</div>
            <div className="text-3xl font-bold ticker-value mt-1">{data.length}</div>
          </div>

        </div>

        <div className="panel p-6 mt-8">

          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-bold">Price Structure</h2>

            <div className="flex gap-2">
              {(["D","W","M"] as const).map(x=>(
                <button
                  key={x}
                  onClick={()=>setTf(x)}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    tf===x
                    ?"bg-primary text-primary-foreground"
                    :"bg-secondary text-secondary-foreground"
                  }`}
                >
                  {x==="D"?"Daily":x==="W"?"Weekly":"Monthly"}
                </button>
              ))}
            </div>

          </div>

          <svg viewBox="0 0 820 260" className="w-full">

            {[0,1,2,3,4].map(i=>(
              <line
                key={i}
                x1="20"
                x2="800"
                y1={20+i*55}
                y2={20+i*55}
                stroke="hsl(var(--border))"
                strokeDasharray="4 6"
              />
            ))}

            {signal && signal.support >= min && signal.support <= max && (
              <line
                x1="20" x2="800"
                y1={srY(signal.support)} y2={srY(signal.support)}
                stroke="hsl(var(--loss))"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}

            {signal && signal.resistance >= min && signal.resistance <= max && (
              <line
                x1="20" x2="800"
                y1={srY(signal.resistance)} y2={srY(signal.resistance)}
                stroke="hsl(var(--profit))"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}

            <polyline
              fill="none"
              stroke="hsl(var(--signal))"
              strokeWidth="3"
              points={points}
            />

            <text x="10" y="20" fill="hsl(var(--muted-foreground))" fontSize="10">
              ₹{max.toFixed(0)}
            </text>

            <text x="10" y="245" fill="hsl(var(--muted-foreground))" fontSize="10">
              ₹{min.toFixed(0)}
            </text>

            {signal && (
              <>
                <text x="805" y={srY(signal.resistance)} fill="hsl(var(--profit))" fontSize="9">Resistance</text>
                <text x="805" y={srY(signal.support)} fill="hsl(var(--loss))" fontSize="9">Support</text>
              </>
            )}

          </svg>

          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{data[0]?.date}</span>
            <span>{data.at(-1)?.date}</span>
          </div>

        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8">

          <div className="panel p-5">
            <div className="text-signal text-xs uppercase tracking-wider mb-2">
              Momentum
            </div>

            <div className="text-4xl font-bold ticker-value">
              {Math.round((current-low)/(high-low||1)*100)}
            </div>

            <div className="text-muted-foreground text-sm mt-2">
              Position within the 2-year range
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-profit text-xs uppercase tracking-wider mb-2">
              Trend Structure
            </div>

            <div className={`text-5xl font-bold ${trend?"text-profit":"text-loss"}`}>
              {trend?"↗":"↘"}
            </div>

            <div className="text-foreground font-medium mt-2">
              {trend?"Bullish Structure":"Bearish Structure"}
            </div>

            <p className="text-muted-foreground text-sm mt-2 leading-6">
              Compare Daily, Weekly and Monthly views before forming an educational conclusion.
            </p>
          </div>

        </div>

        <div className="panel p-6 mt-8">
          <h2 className="text-2xl font-bold mb-5">
            Learning Summary
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            <div className="rounded-xl bg-signal/10 border border-signal/20 p-4">
              <div className="text-signal text-xs uppercase font-semibold mb-2">
                Momentum
              </div>
              <div className="font-semibold text-lg mb-2">RSI Concept</div>
              <p className="text-sm text-muted-foreground leading-6">
                Momentum studies how strongly price is advancing or weakening over time.
              </p>
            </div>

            <div className="rounded-xl bg-profit/10 border border-profit/20 p-4">
              <div className="text-profit text-xs uppercase font-semibold mb-2">
                Trend
              </div>
              <div className="font-semibold text-lg mb-2">Higher Highs</div>
              <p className="text-sm text-muted-foreground leading-6">
                Sustainable uptrends usually develop through higher highs and higher lows.
              </p>
            </div>

            <div className="rounded-xl bg-warning/10 border border-warning/20 p-4">
              <div className="text-warning text-xs uppercase font-semibold mb-2">
                Structure
              </div>
              <div className="font-semibold text-lg mb-2">Multiple Timeframes</div>
              <p className="text-sm text-muted-foreground leading-6">
                Compare Daily, Weekly and Monthly charts to understand market structure.
              </p>
            </div>

          </div>

          <div className="mt-6 rounded-xl bg-secondary/60 border border-border p-4">
            <div className="font-semibold text-signal mb-2">
              📘 Educational Use Only
            </div>
            <p className="text-sm text-muted-foreground leading-6">
              MarketCompass is a learning platform for understanding price structure,
              momentum and trend behaviour. It does not provide investment advice,
              stock recommendations or trading signals.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}
