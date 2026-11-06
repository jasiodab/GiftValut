import { NavLink } from "react-router-dom";
import { Home, Plus, ShoppingBag, Settings as SettingsIcon, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "@/contexts/QuickAddContext";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/products", label: "Products", icon: ShoppingBag },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/settings", label: "Settings", icon: SettingsIcon }
];

export function BottomNav() {
  const { openQuickAdd } = useQuickAdd();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {items.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.8} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={openQuickAdd}
          className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift"
          aria-label="Quick add product"
        >
          <Plus className="h-5 w-5" />
        </button>
        {items.slice(2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.8} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}