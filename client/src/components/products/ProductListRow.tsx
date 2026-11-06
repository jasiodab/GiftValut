import { Link } from "react-router-dom";
import { ExternalLink, Heart } from "lucide-react";
import { ProductImage } from "./ProductImage";
import { StatusBadge } from "./StatusBadge";
import { PriceChange } from "./PriceChange";
import { formatMoney, timeAgo } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToggleFavorite } from "@/hooks/useProductActions";
import { Checkbox } from "@/components/ui/checkbox";

type ProductListRowProps = {
  product: Product;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
};

export function ProductListRow({ product, selectable, selected, onSelectedChange }: ProductListRowProps) {
  const toggleFavorite = useToggleFavorite();
  const isFavorite = product.status === "FAVORITE";

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[auto_52px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 shadow-card transition-all hover:border-border hover:shadow-soft sm:grid-cols-[auto_52px_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-4 md:grid-cols-[auto_52px_minmax(0,1fr)_auto_auto_auto] xl:grid-cols-[auto_52px_minmax(0,1fr)_auto_auto_auto_auto]",
        selected && "border-primary/40 ring-1 ring-primary/15"
      )}
    >
      <Link
        to={`/products/${product.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`Open ${product.name}`}
      />
      <div className="z-20">
        {selectable ? (
          <Checkbox
            checked={Boolean(selected)}
            onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
            aria-label={`Select ${product.name}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => toggleFavorite.mutate({ product })}
            disabled={toggleFavorite.isPending}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-primary-soft hover:text-primary",
              isFavorite && "text-primary"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </button>
        )}
      </div>

      <div className="h-[52px] w-[52px] overflow-hidden rounded-lg border border-border/60">
        <ProductImage src={product.imageUrl} alt={product.name} iconClassName="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {product.category ? (
            <span className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {product.category.name}
            </span>
          ) : null}
          <span className="text-border">·</span>
          <span className="truncate text-[11px] text-muted-foreground">{product.store?.name ?? "Unknown store"}</span>
        </div>
        <h3 className="mt-1 truncate text-sm font-medium leading-tight text-foreground group-hover:text-primary-deep">
          {product.name}
        </h3>
        <div className="mt-1.5">
          <StatusBadge status={product.status} className="py-0.5 md:hidden" />
        </div>
      </div>

      <div className="hidden md:block">
        <StatusBadge status={product.status} />
      </div>

      <div className="hidden text-[11px] text-muted-foreground xl:block">
        <div>{product.availability ?? "No availability"}</div>
        <div className="mt-0.5">Updated {timeAgo(product.lastPriceCheckAt)}</div>
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold">{formatMoney(product.currentPrice, product.currency)}</div>
        <div className="mt-1">
          <PriceChange change={product.priceChange} percent={product.priceChangePercent} />
        </div>
      </div>

      <div className="z-20 hidden items-center justify-end sm:flex">
        <a
          href={product.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Open ${product.name} in store`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
