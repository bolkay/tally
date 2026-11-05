import { Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="shell">
      <header className="topbar">
        <Wordmark />
      </header>
      <div className="empty">
        <strong>This page doesn&apos;t exist</strong>
        <span>Check the link, or start a new group.</span>
        <a className="btn btn-primary" href="/">
          Start a group
        </a>
      </div>
    </main>
  );
}
