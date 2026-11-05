"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Group, type Share } from "@/lib/api";
import { format, parseAmount, splitEqually } from "@/lib/money";
import { Avatar, Icon } from "./ui";

function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function currencySymbol(currency: string) {
  const parts = new Intl.NumberFormat("en-NG", { style: "currency", currency }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

export function AddExpenseSheet({
  group,
  open,
  onClose,
  onSaved,
}: {
  group: Group;
  open: boolean;
  onClose: () => void;
  onSaved: (g: Group) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState(group.members[0]?.id ?? "");
  const [spentOn, setSpentOn] = useState(today());
  const [mode, setMode] = useState<"equal" | "exact">("equal");
  const [included, setIncluded] = useState<Set<string>>(() => new Set(group.members.map((m) => m.id)));
  const [exact, setExact] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDescription("");
      setAmountText("");
      setPaidBy((p) => (group.members.some((m) => m.id === p) ? p : group.members[0]?.id ?? ""));
      setSpentOn(today());
      setMode("equal");
      setIncluded(new Set(group.members.map((m) => m.id)));
      setExact({});
      setError(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, group.members]);

  const amount = parseAmount(amountText);
  const symbol = currencySymbol(group.currency);

  const shares: Share[] | null = useMemo(() => {
    if (mode === "equal") {
      const ids = group.members.filter((m) => included.has(m.id)).map((m) => m.id);
      if (!amount || ids.length === 0) return null;
      const parts = splitEqually(amount, ids.length);
      return ids.map((memberId, i) => ({ memberId, share: parts[i] }));
    }
    const out: Share[] = [];
    for (const m of group.members) {
      const raw = exact[m.id]?.trim();
      if (!raw) continue;
      const v = parseAmount(raw);
      if (v === null) return null;
      out.push({ memberId: m.id, share: v });
    }
    return out;
  }, [mode, amount, included, exact, group.members]);

  const exactSum = mode === "exact" && shares ? shares.reduce((s, x) => s + x.share, 0) : 0;
  const remaining = amount ? amount - exactSum : 0;
  const equalShare = mode === "equal" && shares?.[0] ? shares[0].share : 0;

  function toggle(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) return setError("Add a short description.");
    if (!amount) return setError("Enter the total amount.");
    if (!shares || shares.length === 0)
      return setError(mode === "equal" ? "Pick at least one person to split with." : "Enter a valid amount for each person.");
    if (mode === "exact" && remaining !== 0)
      return setError(remaining > 0 ? `${format(remaining, group.currency)} still to assign.` : `Over by ${format(-remaining, group.currency)}.`);
    setSaving(true);
    try {
      const g = await api.addExpense(group.id, { description: description.trim(), amount, paidBy, spentOn, shares });
      onSaved(g);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="add-expense-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <form className="sheet-form" onSubmit={submit} noValidate>
        <div className="sheet-head">
          <h2 className="h2" id="add-expense-title" style={{ fontSize: 17 }}>
            Add expense
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>

        <label className="field">
          <span className="visually-hidden">Amount</span>
          <div className="amount-input">
            <span aria-hidden="true">{symbol}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-label={`Amount in ${group.currency}`}
              autoFocus
            />
          </div>
        </label>

        <label className="field">
          <span className="label">What was it for?</span>
          <input
            className="input"
            placeholder="Friday dinner"
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="two">
          <label className="field">
            <span className="label">Paid by</span>
            <select className="select" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Date</span>
            <input className="input" type="date" value={spentOn} max={today()} onChange={(e) => setSpentOn(e.target.value)} />
          </label>
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="label">Split</span>
            <div className="segmented" role="group" aria-label="How to split">
              <button type="button" aria-pressed={mode === "equal"} onClick={() => setMode("equal")}>
                Equally
              </button>
              <button type="button" aria-pressed={mode === "exact"} onClick={() => setMode("exact")}>
                Exact amounts
              </button>
            </div>
          </div>

          <ul className="split-rows">
            {group.members.map((m) => {
              const on = mode === "equal" ? included.has(m.id) : !!exact[m.id]?.trim();
              return (
                <li key={m.id} className={`split-row${on ? "" : " off"}`}>
                  {mode === "equal" ? (
                    <label style={{ gridColumn: "1 / 3" }}>
                      <input type="checkbox" className="check" checked={included.has(m.id)} onChange={() => toggle(m.id)} />
                      <Avatar name={m.name} />
                      <span className="split-name">{m.name}</span>
                    </label>
                  ) : (
                    <span style={{ gridColumn: "1 / 3", display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={m.name} />
                      <span className="split-name">{m.name}</span>
                    </span>
                  )}
                  <span className="split-value">
                    {mode === "equal" ? (
                      included.has(m.id) && amount ? format(shares?.find((s) => s.memberId === m.id)?.share ?? 0, group.currency) : "–"
                    ) : (
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`${m.name}'s share`}
                        value={exact[m.id] ?? ""}
                        onChange={(e) => setExact((x) => ({ ...x, [m.id]: e.target.value }))}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="split-summary">
            {mode === "equal" ? (
              <>
                <span>
                  {included.size} of {group.members.length} people
                </span>
                <span>{equalShare ? `${format(equalShare, group.currency)} each` : ""}</span>
              </>
            ) : (
              <>
                <span>Assigned {format(exactSum, group.currency)}</span>
                {amount ? (
                  <span className={remaining === 0 ? "good" : "bad"}>
                    {remaining === 0 ? "Adds up" : remaining > 0 ? `${format(remaining, group.currency)} left` : `Over by ${format(-remaining, group.currency)}`}
                  </span>
                ) : (
                  <span />
                )}
              </>
            )}
          </div>
        </div>

        <div className="sheet-foot">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
