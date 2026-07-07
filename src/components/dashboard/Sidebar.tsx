"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Activity", icon: "◎" },
  { href: "/dashboard/rules", label: "Rules", icon: "▤" },
  { href: "/dashboard/repos", label: "Repositories", icon: "⌥" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-panel/60 px-4 py-6">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-info/15 font-mono text-sm text-signal-info">
          {"</>"}
        </span>
        <span className="font-display text-base font-semibold tracking-tight">GHOps Bot</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-panel-raised text-ink"
                  : "text-ink-muted hover:bg-panel-raised hover:text-ink"
              )}
            >
              <span className="w-4 text-center text-ink-faint">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {session?.user && (
        <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt=""
              width={28}
              height={28}
              className="rounded-full"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{session.user.name}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-ink-faint hover:text-ink"
            aria-label="Sign out"
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      )}
    </aside>
  );
}
