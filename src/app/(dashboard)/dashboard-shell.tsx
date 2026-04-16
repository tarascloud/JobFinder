"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  User,
  Search,
  Briefcase,
  Send,
  MessageSquare,
  Mail,
  BarChart3,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import BottomNav from "@/components/shared/bottom-nav";
import { NotificationBell } from "@/components/shared/notification-bell";
import { signOut } from "next-auth/react";
import { exitDemoMode } from "@/actions/demo";
import { getUnreadEmailCount } from "@/actions/emails";
import { getNewVacanciesCount } from "@/actions/vacancies";

const navItems = [
  { href: "/profile", key: "profile", icon: User },
  { href: "/qa", key: "qa", icon: MessageSquare },
  { href: "/searches", key: "searches", icon: Search },
  { href: "/vacancies", key: "vacancies", icon: Briefcase },
  { href: "/applications", key: "applications", icon: Send },
  { href: "/emails", key: "emails", icon: Mail },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
] as const;

const bottomNavItems = [
  { href: "/admin", key: "admin", icon: Shield, ownerOnly: true },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export default function DashboardShell({
  children,
  isDemo = false,
  userRole = "user",
}: {
  children: React.ReactNode;
  isDemo?: boolean;
  userRole?: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  const [newVacanciesCount, setNewVacanciesCount] = useState(0);
  const t = useTranslations("nav");

  useEffect(() => {
    if (!isDemo) {
      getUnreadEmailCount()
        .then((data) => {
          if ("count" in data && typeof data.count === "number") setUnreadEmailCount(data.count);
        })
        .catch(() => {});
      getNewVacanciesCount()
        .then((count) => setNewVacanciesCount(count))
        .catch(() => {});
    }
  }, [isDemo, pathname]);

  // Placeholder session data
  const user = isDemo
    ? { name: "Demo", image: null as string | null }
    : { name: "Taras", image: null as string | null };

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="p-6 pb-4">
        <Link href="/" className="text-xl font-bold text-primary">
          JobFinder
        </Link>
      </div>

      {/* User avatar */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
          {user.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground">{isDemo ? "Demo" : "Owner"}</p>
        </div>
      </div>

      <div className="flex-1 px-3 space-y-1">
        {navItems.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {t(key)}
            {key === "vacancies" && newVacanciesCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                {newVacanciesCount}
              </Badge>
            )}
            {key === "emails" && unreadEmailCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                {unreadEmailCount}
              </Badge>
            )}
          </Link>
        ))}
      </div>
      {/* Settings at bottom */}
      <div className="px-3 mb-1">
        {bottomNavItems
          .filter((item) => !("ownerOnly" in item && item.ownerOnly) || userRole === "owner")
          .map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {t(key)}
          </Link>
        ))}
      </div>
      {/* Sidebar footer with toggles */}
      <div className="border-t border-sidebar-border px-3 py-3 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sidebar-border bg-sidebar">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50">
            <div className="absolute right-3 top-5">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-accent text-accent-foreground">
                <Eye className="h-3 w-3" />
                Demo
              </span>
            )}
            {!isDemo && <NotificationBell />}
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
              {user.name.charAt(0)}
            </div>
            {isDemo ? (
              <form action={exitDemoMode}>
                <Button variant="ghost" size="icon" title="Exit demo" type="submit">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                title="Sign out"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
