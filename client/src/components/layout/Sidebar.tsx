import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowUpRight,
  FolderHeart,
  Gift,
  LayoutDashboard,
  Menu,
  Plus,
  Settings as SettingsIcon,
  ShoppingBag,
  Tags,
  Vault,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeta } from "@/lib/queries";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { useQuickAdd } from "@/contexts/QuickAddContext";
import { Button } from "@/components/ui/button";

const primaryNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/products", label: "All Products", icon: ShoppingBag, badge: true },
  { to: "/categories", label: "Categories", icon: Tags }
];

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { data: meta } = useMeta();
  const { openQuickAdd } = useQuickAdd();
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme() ?? "light");
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-card transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)"
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-5 pb-4 pt-5">
            <NavLink to="/" className="flex items-center gap-3" onClick={onCloseMobile}>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_5px_14px_-6px_rgba(160,74,96,0.7)]">
                <Vault className="h-[19px] w-[19px]" strokeWidth={1.8} />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-border bg-success" />
              </div>
              <div>
                <div className="font-display text-[20px] font-semibold leading-none tracking-[-0.03em] text-foreground">
                  Gift Vault
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Personal collection
                </div>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pb-5">
            <button
              type="button"
              onClick={() => {
                openQuickAdd();
                onCloseMobile();
              }}
              className="group flex w-full items-center justify-between rounded-xl bg-foreground px-4 py-3 text-left text-background shadow-[0_10px_26px_-18px_rgba(47,43,38,0.9)] transition-all hover:bg-foreground/90 active:translate-y-px"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background/10">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-medium">Quick add product</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-background/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-background/80" />
            </button>
          </div>

          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3">
            <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </p>
            <div className="space-y-0.5">
              {primaryNav.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  end={item.end}
                  badge={item.badge ? meta?.productCount : undefined}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card/80 p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderHeart className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-medium">Your collection</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <span className="font-display text-2xl font-semibold tracking-tight">
                    {meta?.productCount ?? 0}
                  </span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">products saved</span>
                </div>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                A quiet place for every gift idea, price drop and thoughtful find.
              </p>
            </div>
          </nav>

          <div className="border-t border-border px-4 py-4">
            <NavItem
              to="/settings"
              label="Settings"
              icon={SettingsIcon}
              onNavigate={onCloseMobile}
              footer
            />
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    meta?.database === "connected" ? "bg-success" : "bg-destructive"
                  )}
                />
                <div>
                  <div className="text-[10px] font-medium text-secondary-foreground">Local database</div>
                  <div className="text-[9px] text-muted-foreground">
                    {meta?.database === "connected" ? "Connected · stored on this device" : "Connection issue"}
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-medium text-muted-foreground">v1.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  badge,
  end,
  footer,
  onNavigate
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  end?: boolean;
  footer?: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
          footer
            ? "text-muted-foreground hover:bg-card hover:text-foreground"
            : isActive
              ? "bg-card text-foreground shadow-[0_1px_2px_rgba(60,50,40,0.05)]"
              : "text-muted-foreground hover:bg-card hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "h-[17px] w-[17px] shrink-0 transition-colors",
              isActive && !footer ? "text-primary" : "text-muted-foreground group-hover:text-muted-foreground"
            )}
            strokeWidth={1.8}
          />
          <span className="flex-1">{label}</span>
          {badge !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums",
                isActive ? "bg-primary-soft text-primary-deep" : "bg-border text-muted-foreground"
              )}
            >
              {badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function MobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-card/90 px-4 py-2.5 backdrop-blur-md lg:hidden"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="-ml-1 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Vault className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-semibold">Gift Vault</span>
        </div>
      </div>
    </div>
  );
}
