// Groups this browser has opened, so people can find them again without an account.
export type RecentGroup = { id: string; name: string; visitedAt: number };
const KEY = "tally.recent";

export function readRecent(): RecentGroup[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentGroup[]) : [];
    return Array.isArray(list) ? list.sort((a, b) => b.visitedAt - a.visitedAt) : [];
  } catch {
    return [];
  }
}

export function rememberGroup(id: string, name: string) {
  try {
    const list = readRecent().filter((g) => g.id !== id);
    list.unshift({ id, name, visitedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

export function forgetGroup(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readRecent().filter((g) => g.id !== id)));
  } catch {}
}
