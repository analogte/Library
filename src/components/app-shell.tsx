"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Search, Languages, Settings, Brain, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReviewCount } from "@/hooks/use-review-count";

const NAV_ITEMS = [
  { href: "/", label: "ห้องสมุด", icon: BookOpen },
  { href: "/review", label: "ทบทวน", icon: Brain, showBadge: true },
  { href: "/notes", label: "บันทึก", icon: FileText },
  { href: "/search", label: "ค้นหา", icon: Search },
  { href: "/vocabulary", label: "คำศัพท์", icon: Languages },
  { href: "/analytics", label: "สถิติ", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "ห้องสมุด", icon: BookOpen },
  { href: "/notes", label: "บันทึก", icon: FileText },
  { href: "/search", label: "ค้นหา", icon: Search },
  { href: "/vocabulary", label: "คำศัพท์", icon: Languages },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reviewCount = useReviewCount();

  // Hide shell in reader mode
  if (pathname.startsWith("/reader/")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r bg-card md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-semibold">ห้องสมุดส่วนตัว</span>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const badge = "showBadge" in item && item.showBadge && reviewCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                  )}>
                    {reviewCount > 99 ? "99+" : reviewCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56">
        <div className="mx-auto max-w-6xl p-4 pb-20 md:p-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card md:hidden">
        <div className="flex h-16 items-center justify-around">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
