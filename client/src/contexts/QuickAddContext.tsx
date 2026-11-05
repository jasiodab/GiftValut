import { createContext, useContext } from "react";

type QuickAddContextValue = {
  openQuickAdd: () => void;
};

export const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const context = useContext(QuickAddContext);
  if (!context) throw new Error("useQuickAdd must be used inside the app shell.");
  return context;
}
