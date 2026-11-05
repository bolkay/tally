"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Expense, type Group } from "@/lib/api";
import { format } from "@/lib/money";
import { forgetGroup, rememberGroup } from "@/lib/recent";
import { AddExpenseSheet } from "./AddExpenseSheet";
import { BalanceChart } from "./BalanceChart";
import { Avatar, Icon, Toast, Wordmark } from "./ui";

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((start.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function GroupView() {
  const [id, setId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  const notify = (msg: string) => {
    setToast(null);
    requestAnimationFrame(() => setToast(msg));
  };

  useEffect(() => {
    const match = window.location.pathname.match(/^\/g\/([^/]+)/);
    setId(match ? decodeURIComponent(match[1]) : new URLSearchParams(window.location.search).get("id"));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const g = await api.getGroup(id);
      setGroup(g);
      setError(null);
      rememberGroup(g.id, g.name);
      document.title = `${g.name} · Tally`;
    } catch (e) {
      setError(e as ApiError);
      if ((e as ApiError).status === 404) forgetGroup(id);
    }
  }, [id]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const names = useMemo(() => new Map(group?.members.map((m) => [m.id, m.name]) ?? []), [group]);
  const name = (memberId: string) => names.get(memberId) ?? "Someone";

  const days = useMemo(() => {
    const out: { day: string; items: Expense[] }[] = [];
    for (const e of group?.expenses ?? []) {
      const last = out[out.length - 1];
      if (last && last.day === e.spentOn) last.items.push(e);
      else out.push({ day: e.spentOn, items: [e] });
    }
    return out;
  }, [group]);

  async function share() {
    if (!group) return;
    const url = `${window.location.origin}/g/${group.id}`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: group.name, text: `Track ${group.name} expenses on Tally`, url });
        return;
      } catch {
        // Fall back to copying when the share sheet is dismissed or unavailable.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function recordPayment(from: string, to: string, amount: number) {
    if (!group) return;
    const key = `${from}-${to}`;
    setBusy(key);
    try {
      setGroup(await api.addPayment(group.id, { from, to, amount }));
      notify(`Recorded ${name(from)} paying ${name(to)}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!group) return;
    setBusy(expenseId);
    try {
      setGroup(await api.deleteExpense(group.id, expenseId));
      setOpenItem(null);
      setConfirmDelete(null);
      notify("Deleted");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!group || !newPerson.trim()) return;
    setBusy("person");
    try {
      setGroup(await api.addMember(group.id, newPerson.trim()));
      notify(`Added ${newPerson.trim()}`);
      setNewPerson("");
      setAddingPerson(false);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !group) {
    return (
      <main className="shell">
        <header className="topbar">
          <Wordmark />
        </header>
        <div className="empty">
          <strong>{error.status === 404 ? "Group not found" : "Couldn't load this group"}</strong>
          <span>{error.message}</span>
          {error.status === 404 ? (
            <a className="btn btn-primary" href="/">
              Start a new group
            </a>
          ) : (
            <button className="btn btn-primary" onClick={load}>
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="shell" aria-busy="true">
        <header className="topbar">
          <Wordmark />
        </header>
        <div className="skeleton" style={{ height: 40, width: "60%" }} />
        <div className="skeleton" style={{ height: 18, width: "35%", marginTop: 14 }} />
        <div className="skeleton" style={{ height: 180, marginTop: 44, borderRadius: 20 }} />
      </main>
    );
  }

  const hasExpenses = group.expenses.length > 0;

  return (
    <main className="shell">
      <header className="topbar">
        <Wordmark />
        <button className="btn btn-quiet" onClick={share}>
          <Icon name="share" />
          Share link
        </button>
      </header>

      <section className="group-head">
        <h1 className="h1">{group.name}</h1>
        <div className="group-meta">
          <span className="stack" aria-hidden="true">
            {group.members.slice(0, 6).map((m) => (
              <Avatar key={m.id} name={m.name} />
            ))}
          </span>
          <span className="meta">
            {group.members.length} people
            {hasExpenses && (
              <>
                , <span className="num">{format(group.totalSpent, group.currency)}</span> spent
              </>
            )}
          </span>
        </div>
      </section>

      <section className="section" aria-labelledby="balances">
        <div className="section-head">
          <h2 className="h2" id="balances">
            Balances
          </h2>
          {!addingPerson && (
            <button className="btn btn-text" onClick={() => setAddingPerson(true)}>
              Add person
            </button>
          )}
        </div>
        {hasExpenses ? (
          <BalanceChart
            currency={group.currency}
            rows={group.balances.map((b) => ({ id: b.memberId, name: name(b.memberId), net: b.net }))}
          />
        ) : (
          <div className="empty">
            <strong>Nothing spent yet</strong>
            <span>Add the first expense and everyone&apos;s balance shows up here.</span>
            <button className="btn btn-primary" onClick={() => setSheetOpen(true)}>
              <Icon name="plus" />
              Add expense
            </button>
          </div>
        )}
        {addingPerson && (
          <form className="inline-form" onSubmit={addPerson}>
            <label className="visually-hidden" htmlFor="new-person">
              Name
            </label>
            <input
              id="new-person"
              className="input"
              placeholder="Their name"
              maxLength={40}
              autoFocus
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAddingPerson(false)}
            />
            <button className="btn btn-primary" disabled={!newPerson.trim() || busy === "person"}>
              Add
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setAddingPerson(false)}>
              Cancel
            </button>
          </form>
        )}
      </section>

      {hasExpenses && (
        <section className="section" aria-labelledby="settle">
          <div className="section-head">
            <h2 className="h2" id="settle">
              Settle up
            </h2>
            {group.settleUp.length > 1 && <span className="meta">{group.settleUp.length} payments clear everything</span>}
          </div>
          {group.settleUp.length === 0 ? (
            <div className="settled">
              <Icon name="check" />
              Everyone is square.
            </div>
          ) : (
            <ul className="transfers">
              {group.settleUp.map((t) => (
                <li className="transfer" key={`${t.from}-${t.to}`}>
                  <p>
                    <Avatar name={name(t.from)} />
                    <strong style={{ fontWeight: 500 }}>{name(t.from)}</strong>
                    <span className="pays">pays</span>
                    <strong style={{ fontWeight: 500 }}>{name(t.to)}</strong>
                    <span className="amt num">{format(t.amount, group.currency)}</span>
                  </p>
                  <button
                    className="btn btn-quiet"
                    disabled={busy === `${t.from}-${t.to}`}
                    onClick={() => recordPayment(t.from, t.to, t.amount)}
                  >
                    {busy === `${t.from}-${t.to}` ? "Recording…" : "Mark paid"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasExpenses && (
        <section className="section" aria-labelledby="activity">
          <div className="section-head">
            <h2 className="h2" id="activity">
              Activity
            </h2>
          </div>
          {days.map(({ day, items }) => (
            <div className="day" key={day}>
              <div className="day-label">{dayLabel(day)}</div>
              <ul className="activity">
                {items.map((e) => {
                  const expanded = openItem === e.id;
                  const isPayment = e.kind === "payment";
                  return (
                    <li key={e.id} className={`item${isPayment ? " payment" : ""}`}>
                      <button
                        className="item-btn"
                        aria-expanded={expanded}
                        onClick={() => {
                          setOpenItem(expanded ? null : e.id);
                          setConfirmDelete(null);
                        }}
                      >
                        <Avatar name={name(e.paidBy)} />
                        <span style={{ minWidth: 0 }}>
                          <span className="item-title">
                            {isPayment ? `${name(e.paidBy)} paid ${name(e.shares[0]?.memberId ?? "")}` : e.description}
                          </span>
                          <span className="item-sub">
                            {isPayment
                              ? "Payment"
                              : `${name(e.paidBy)} paid, split ${e.shares.length} way${e.shares.length === 1 ? "" : "s"}`}
                          </span>
                        </span>
                        <span className="item-amount">{format(e.amount, group.currency)}</span>
                      </button>
                      {expanded && (
                        <div className="item-detail">
                          {!isPayment && (
                            <ul className="split-list">
                              {e.shares.map((s) => (
                                <li key={s.memberId}>
                                  <span>{name(s.memberId)}</span>
                                  <span className="num">{format(s.share, group.currency)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div>
                            {confirmDelete === e.id ? (
                              <span style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
                                <span className="meta">Delete for everyone?</span>
                                <button className="btn btn-text btn-danger" disabled={busy === e.id} onClick={() => deleteExpense(e.id)}>
                                  {busy === e.id ? "Deleting…" : "Delete"}
                                </button>
                                <button className="btn btn-text" onClick={() => setConfirmDelete(null)}>
                                  Keep
                                </button>
                              </span>
                            ) : (
                              <button className="btn btn-text btn-danger" onClick={() => setConfirmDelete(e.id)}>
                                Delete {isPayment ? "payment" : "expense"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {hasExpenses && (
        <div className="fab-wrap">
          <button className="btn btn-primary btn-lg" onClick={() => setSheetOpen(true)}>
            <Icon name="plus" />
            Add expense
          </button>
        </div>
      )}

      <AddExpenseSheet
        group={group}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={(g) => {
          setGroup(g);
          setSheetOpen(false);
          notify("Expense added");
        }}
      />
      <Toast message={toast} />
    </main>
  );
}
