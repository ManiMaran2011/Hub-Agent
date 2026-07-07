"use client";

import { useEffect, useState } from "react";

interface Repo {
  id: string;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  _count: { events: number };
}

interface Installation {
  id: string;
  accountLogin: string;
  accountType: string;
  suspended: boolean;
  repositories: Repo[];
}

export function ReposPanel() {
  const [installations, setInstallations] = useState<Installation[] | null>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((json) => setInstallations(json.installations))
      .catch(() => setInstallations([]));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Repositories</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Repos you&apos;ve granted GHOps Bot access to via the GitHub App.
          </p>
        </div>
        <a
          href="/api/github/install"
          className="rounded-md bg-signal-info px-4 py-2 text-sm font-medium text-canvas hover:opacity-90"
        >
          Connect a repository
        </a>
      </div>

      {installations === null && (
        <div className="h-32 animate-pulse rounded-card border border-border bg-panel" />
      )}

      {installations !== null && installations.length === 0 && (
        <div className="rounded-card border border-dashed border-border bg-panel/40 p-10 text-center">
          <p className="font-display text-base font-medium text-ink">No repositories connected</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            You&apos;ll be sent to GitHub to choose which repository (or repositories)
            to grant access to. GHOps Bot only ever sees what you explicitly select.
          </p>
        </div>
      )}

      {installations !== null && installations.length > 0 && (
        <div className="space-y-6">
          {installations.map((inst) => (
            <div key={inst.id} className="rounded-card border border-border bg-panel">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-mono text-xs text-ink-muted">
                  {inst.accountType.toLowerCase()} · {inst.accountLogin}
                </span>
                {inst.suspended && (
                  <span className="rounded-full bg-signal-fail-dim px-2 py-0.5 text-[11px] text-signal-fail">
                    Suspended
                  </span>
                )}
              </div>
              <ul className="divide-y divide-border">
                {inst.repositories.map((repo) => (
                  <li key={repo.id} className="flex items-center justify-between px-4 py-3">
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink hover:underline"
                    >
                      {repo.fullName}
                    </a>
                    <span className="font-mono text-xs text-ink-faint">
                      {repo._count.events} event{repo._count.events === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
                {inst.repositories.length === 0 && (
                  <li className="px-4 py-3 text-sm text-ink-faint">
                    No repositories granted for this installation yet.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
