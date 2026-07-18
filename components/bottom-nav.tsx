"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today", icon: "◉" },
  { href: "/log", label: "Log", icon: "＋" },
  { href: "/calendar", label: "Calendar", icon: "▦" },
  { href: "/subjects", label: "Subjects", icon: "≣" },
  { href: "/stats", label: "Stats", icon: "◫" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active =
            t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-w-16 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
