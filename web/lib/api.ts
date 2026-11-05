export type Member = { id: string; name: string };
export type Share = { memberId: string; share: number };
export type Expense = {
  id: string;
  kind: "expense" | "payment";
  description: string;
  amount: number;
  paidBy: string;
  spentOn: string;
  createdAt: string;
  shares: Share[];
};
export type Balance = { memberId: string; paid: number; owed: number; net: number };
export type Transfer = { from: string; to: string; amount: number };
export type Group = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  members: Member[];
  expenses: Expense[];
  balances: Balance[];
  settleUp: Transfer[];
  totalSpent: number;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Can't reach Tally. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    let message = res.status === 404 ? "This group doesn't exist or was removed." : "Something went wrong on our side. Try again.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createGroup: (body: { name: string; currency: string; members: string[] }) =>
    call<{ id: string }>("/groups", { method: "POST", body: JSON.stringify(body) }),
  getGroup: (id: string) => call<Group>(`/groups/${encodeURIComponent(id)}`),
  addMember: (id: string, name: string) =>
    call<Group>(`/groups/${encodeURIComponent(id)}/members`, { method: "POST", body: JSON.stringify({ name }) }),
  addExpense: (
    id: string,
    body: { description: string; amount: number; paidBy: string; spentOn: string; shares: Share[] }
  ) => call<Group>(`/groups/${encodeURIComponent(id)}/expenses`, { method: "POST", body: JSON.stringify(body) }),
  addPayment: (id: string, body: { from: string; to: string; amount: number }) =>
    call<Group>(`/groups/${encodeURIComponent(id)}/payments`, { method: "POST", body: JSON.stringify(body) }),
  deleteExpense: (id: string, expenseId: string) =>
    call<Group>(`/groups/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" }),
};
