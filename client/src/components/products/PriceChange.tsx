import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type PriceChangeProps = {
  change: number | null;
  percent: number | null;
  className?: string;
  showValue?: boolean;
  currency?: string;
};

export function PriceChange({ change, percent, className, showValue = false, currency = "PLN" }: PriceChangeProps) {
  if (change === null || percent === null) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)}>
        <Minus className="h-3 w-3" /> No change
      </span>
    );
  }

  const isDrop = change < 0;
  const Icon = isDrop ? ArrowDownRight : ArrowUpRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        isDrop ? "text-success" : "text-destructive",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {showValue ? `${change > 0 ? "+" : ""}${change.toFixed(2)} ${currency} · ` : ""}
      {formatPercent(percent)}
    </span>
  );
}
