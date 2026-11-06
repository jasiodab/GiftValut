import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar, MobileHeader } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { QuickAddContext } from "@/contexts/QuickAddContext";
import { Toaster } from "sonner";
import type { Product } from "@/lib/types";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setMobileOpen(false);
  }, [location.pathname]);

  const contextValue = useMemo(
    () => ({ openQuickAdd: () => setQuickAddOpen(true) }),
    []
  );

  return (
    <QuickAddContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <div className="min-h-screen lg:pl-[260px]">
          <MobileHeader onOpen={() => setMobileOpen(true)} />
          <main className="page-enter mx-auto w-full max-w-[1560px] px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8 xl:px-10">
            <Outlet />
          </main>
        </div>
        <BottomNav />
        <ProductFormDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          onSaved={(product: Product) => navigate(`/products/${product.id}`)}
        />
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            className: "font-sans",
            style: {
              borderRadius: "12px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))"
            }
          }}
        />
      </div>
    </QuickAddContext.Provider>
  );
}
