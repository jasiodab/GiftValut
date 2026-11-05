import { CheckCircle2, Clock3, HelpCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AvailabilityBadge({ availability, className }: { availability: string | null; className?: string }) {
  if (!availability) return null;
  const normalized = availability.toLowerCase();
  const isInStock = normalized.includes("in stock");
  const isOut = normalized.includes("out of stock") || normalized.includes("sold") || normalized.includes("discontinued");
  const isPre = normalized.includes("pre-order") || normalized.includes("back order") || normalized.includes("limited");
  const Icon = isInStock ? CheckCircle2 : isOut ? XCircle : isPre ? Clock3 : HelpCircle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium",
        isInStock ? "text-success" : isOut ? "text-destructive" : isPre ? "text-warning" : "text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {availability}
    </span>
  );
}
