import { STATUS_META } from "@/lib/constants";
import type { ProductStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: ProductStatus;
  className?: string;
  showIcon?: boolean;
};

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.TO_CONSIDER;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        meta.className,
        className
      )}
    >
      {showIcon ? <Icon className="h-3 w-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClassName)} />}
      {meta.label}
    </span>
  );
}
