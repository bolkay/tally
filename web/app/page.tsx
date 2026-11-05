"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CURRENCIES } from "@/lib/money";
import { readRecent, type RecentGroup } from "@/lib/recent";
import { BalanceChart } from "@/components/BalanceChart";
import { Avatar, Icon, Wordmark } from "@/components/ui";

const SAMPLE = [
  { id: "a", name: "Ada", net: 1850000 },
  { id: "t", name: "Tunde", net: -1100000 },
  { id: "c", name: "Chioma", net: 300000 },
  { id: "f", name: "Femi", net: -1050000 },
];

export default function Home() {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<RecentGroup[]>([]);
  const peopleInput = useRef<HTMLInputElement>(null);

  useEffect(() => setRecent(readRecent()), []);

  function addPerson(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setPeople((prev) => {
      const next = [...prev];
      for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 40));
      return next;
    });
    setDraft("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const all = [...people];
    if (draft.trim() && !all.some((x) => x.toLowerCase() === draft.trim().toLowerCase())) all.push(draft.trim());
    if (!name.trim()) return setError("Give the group a name.");
    if (all.length < 2) return setError("Add at least two people, including yourself.");
    setSaving(true);
    try {
      const { id } = await api.createGroup({ name: name.trim(), currency, members: all });
      window.location.assign(`/g/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Wordmark />
      </header>

      <section className="home-hero">
        <h1 className="display">Shared costs, settled without the awkward maths.</h1>
        <p className="lede">
          Start a group for a trip, a flat or a night out. Everyone adds what they paid, and Tally shows who pays whom.
          No sign-up, just a link.
        </p>
      </section>

      <form className="create" onSubmit={create} noValidate>
        <div className="create-row">
          <label className="field">
            <span className="label">Group name</span>
            <input
              className="input"
              placeholder="Weekend away"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">Currency</span>
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <label className="label" htmlFor="people">
            People
          </label>
          <div className="chips" onClick={() => peopleInput.current?.focus()}>
            {people.map((p) => (
              <span className="chip" key={p}>
                <Avatar name={p} />
                {p}
                <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPeople((prev) => prev.filter((x) => x !== p));
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            <input
              id="people"
              ref={peopleInput}
              placeholder={people.length ? "Add another" : "Type a name and press Enter"}
              value={draft}
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                if (v.includes(",")) addPerson(v);
                else setDraft(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPerson(draft);
                } else if (e.key === "Backspace" && !draft && people.length) {
                  setPeople((prev) => prev.slice(0, -1));
                }
              }}
              onBlur={() => addPerson(draft)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? "Creating…" : "Create group"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>

      {recent.length > 0 && (
        <section className="recent" aria-labelledby="recent">
          <h2 className="h2" id="recent">
            Your groups
          </h2>
          <ul>
            {recent.map((g) => (
              <li key={g.id}>
                <a href={`/g/${g.id}`}>
                  {g.name}
                  <span style={{ color: "var(--muted)", display: "inline-flex", width: 16 }}>
                    <Icon name="arrow" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section" aria-labelledby="preview" style={{ marginTop: 64 }}>
        <div className="section-head">
          <h2 className="h2" id="preview">
            What your group sees
          </h2>
          <span className="meta">Sample: a weekend away</span>
        </div>
        <BalanceChart rows={SAMPLE} currency="NGN" />
        <div className="how">
          <p style={{ margin: 0 }}>
            <strong>Add what you paid</strong>
            Split it equally or by exact amounts, with whoever was there.
          </p>
          <p style={{ margin: 0 }}>
            <strong>See where everyone stands</strong>
            Red means someone owes the group, green means the group owes them.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Settle in few payments</strong>
            Tally works out the fewest transfers to clear every balance.
          </p>
        </div>
      </section>
    </main>
  );
}
