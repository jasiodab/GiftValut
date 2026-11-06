import { Link } from "react-router-dom";
import { ExternalLink, Heart, ImageOff } from "lucide-react";
import { ProductImage } from "./ProductImage";
import { StatusBadge } from "./StatusBadge";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { useToggleFavorite } from "@/hooks/useProductActions";
import { Checkbox } from "@/components/ui/checkbox";

type ProductCardProps = {
  product: Product;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  className?: string;
};

export function ProductCard({ product, selectable, selected, onSelectedChange, className }: ProductCardProps) {
  const toggleFavorite = useToggleFavorite();
  const isFavorite = product.status === "FAVORITE";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-lift",
        selected && "border-primary/50 ring-1 ring-primary/20",
        className
      )}
    >
      <Link
        to={`/products/${product.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`Open ${product.name}`}
      />

      <div className="relative aspect-[4/3] overflow-hidden bg-card">
        <div className="pointer-events-none h-full w-full">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            imageClassName="group-hover:scale-[1.025]"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t bg-foreground/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {selectable ? (
          <div className="absolute left-3 top-3 z-20 rounded-md border border-border/80 bg-card/90 p-1.5 shadow-sm backdrop-blur-sm">
            <Checkbox
              checked={Boolean(selected)}
              onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
              aria-label={`Select ${product.name}`}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            toggleFavorite.mutate({ product });
          }}
          disabled={toggleFavorite.isPending}
          className={cn(
            "absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:text-primary disabled:opacity-60",
            isFavorite && "border-primary/20 bg-primary-soft text-primary-deep"
          )}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </button>
      </div>

      <div className="pointer-events-none flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {product.category ? (
            <>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: product.category.color }}
              />
              <span className="truncate">{product.category.name}</span>
              <span className="text-border">·</span>
            </>
          ) : null}
          <span className="truncate normal-case tracking-normal text-[11px]">{product.store?.name ?? "Unknown store"}</span>
        </div>

        <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-medium leading-snug text-foreground transition-colors group-hover:text-primary-deep">
          {product.name}
        </h3>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-[17px] font-semibold tracking-[-0.02em]">
                {formatMoney(product.currentPrice, product.currency)}
              </span>
              {product.originalPrice && product.currentPrice !== null && product.originalPrice > product.currentPrice ? (
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatMoney(product.originalPrice, product.currency)}
                </span>
              ) : null}
            </div>
            {product.discountPercent ? (
              <div className="mt-1">
                <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                  -{product.discountPercent}%
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={product.status} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <AvailabilityBadge availability={product.availability} />
            {!product.availability ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <ImageOff className="h-3 w-3" />
                {product.imageUrl ? "No availability data" : "No image"}
              </span>
            ) : null}
          </div>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="pointer-events-auto relative z-20 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={`Open ${product.name} in store`}
          >
            Store <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
