import type { CSSProperties } from "react";
import { format } from "@/lib/money";
import { Avatar } from "./ui";

export type ChartRow = { id: string; name: string; net: number };

/**
 * People who owe grow left from the center line, people who are owed grow right.
 * Bar length is relative to the largest balance in the group.
 */
export function BalanceChart({ rows, currency }: { rows: ChartRow[]; currency: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  const sorted = [...rows].sort((a, b) => b.net - a.net);

  return (
    <div>
      <div className="ledger-legend" aria-hidden="true">
        <span>Owes</span>
        <span>Is owed</span>
      </div>
      <ul className="ledger" style={{ listStyle: "none", margin: 0, paddingLeft: 0 }}>
        {sorted.map((r, i) => {
          const pct = Math.abs(r.net) / max;
          const barStyle = {
            "--pct": pct.toFixed(4),
            "--delay": `${i * 50}ms`,
          } as CSSProperties;
          const label = (side: "left" | "right") => (
            <span className="ledger-label">
              <span className="ledger-name">{r.name}</span>
              <span className={`ledger-amount ${r.net < 0 ? "owes" : r.net > 0 ? "owed" : "even"}`}>
                {r.net === 0 ? "Settled" : format(Math.abs(r.net), currency)}
              </span>
            </span>
          );
          const description =
            r.net === 0
              ? `${r.name} is settled`
              : r.net < 0
                ? `${r.name} owes ${format(-r.net, currency)}`
                : `${r.name} is owed ${format(r.net, currency)}`;

          return (
            <li className="ledger-row" key={r.id} aria-label={description}>
              <div className="ledger-side left" aria-hidden="true">
                {r.net < 0 && (
                  <>
                    {label("left")}
                    <Avatar name={r.name} />
                    <span className="bar owes" style={barStyle} />
                  </>
                )}
              </div>
              <div className="ledger-side right" aria-hidden="true">
                {r.net >= 0 && (
                  <>
                    {r.net > 0 && <span className="bar owed" style={barStyle} />}
                    <Avatar name={r.name} />
                    {label("right")}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
