"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Compass, Sparkles, Wand2, FolderOpen, User, CreditCard, Sun, Moon, Coins } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const NAV = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/effects", label: "Effects", icon: Wand2 },
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/profile", label: "Profil", icon: User },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { theme, toggleTheme, credits } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-screen md:pl-56">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-bg p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">H</span>
          Higgs Clone
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active(href) ? "bg-surface2 font-medium" : "text-muted hover:bg-surface"
              }`}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted">Prototyp mit Mock-Daten</p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="font-bold md:hidden">Higgs Clone</Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm">
            <Coins size={14} className="text-accent" /> {credits}
          </span>
          <button
            onClick={toggleTheme}
            aria-label="Theme wechseln"
            className="grid h-8 w-8 place-items-center rounded-full bg-surface hover:bg-surface2"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="p-4 pb-24 md:p-6 md:pb-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-bg/90 py-2 backdrop-blur md:hidden">
        {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-col items-center text-[11px] ${active(href) ? "text-accent" : "text-muted"}`}>
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
