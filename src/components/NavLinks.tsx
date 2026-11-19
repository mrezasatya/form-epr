"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/pr" ? path === "/pr" || /^\/pr\/(?!baru)/.test(path) : path.startsWith(href);
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
            active(l.href) ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {l.label}
          {!!l.badge && (
            <span className="rounded-full bg-red-600 px-1.5 text-xs leading-5 text-white">{l.badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
