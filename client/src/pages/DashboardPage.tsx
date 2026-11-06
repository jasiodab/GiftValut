import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Gift,
  Heart,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Wallet
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/products/StatusBadge";
import { useDashboard, useMeta } from "@/lib/queries";
import { useQuickAdd } from "@/contexts/QuickAddContext";
import { formatCompactMoney, formatDate, formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import type { Product } from "@/lib/types";

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: meta } = useMeta();
  const { openQuickAdd } = useQuickAdd();

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Your gift collection"
        description="A considered view of the products you’ve saved, the prices worth watching, and what’s next."
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-xs text-muted-foreground shadow-card sm:flex">
              <CalendarDays className="h-3.5 w-3.5" />
              {today}
            </div>
            <Button onClick={openQuickAdd}>
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          </>
        }
      />

      {isLoading ? <DashboardSkeleton /> : null}

      {isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">The dashboard could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check that the local server and database are running.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {data ? (
        <>
          {data.stats.totalProducts === 0 ? (
            <Card className="overflow-hidden border-border bg-gradient-to-br bg-card bg-card p-8">
              <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div className="max-w-xl">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <Gift className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl font-medium">Your vault is ready for its first find.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Paste a link from any online store. Gift Vault will try to capture the product details and keep a
                    history of its price. You can always correct anything before saving.
                  </p>
                  <Button className="mt-5" onClick={openQuickAdd}>
                    <Plus className="h-4 w-4" /> Add your first product
                  </Button>
                </div>
                <div className="flex w-full max-w-[260px] items-center gap-3 rounded-xl border border-border/80 bg-card/60 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Automatic details</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Extract names, images and prices from store links.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Saved products"
              value={data.stats.totalProducts}
              detail={`${data.stats.withPrice} with a price`}
              icon={Package}
              tone="neutral"
            />
            <StatCard
              label="Favorites"
              value={data.stats.favorites}
              detail="Most-loved ideas"
              icon={Heart}
              tone="rose"
            />
            <StatCard
              label="To buy"
              value={data.stats.toBuy}
              detail="In the shopping plan"
              icon={ShoppingBag}
              tone="amber"
            />
            <StatCard
              label="Purchased"
              value={data.stats.purchased}
              detail="Gifts secured"
              icon={Check}
              tone="sage"
            />
            <StatCard
              label="Estimated value"
              value={formatCompactMoney(data.stats.totalValue, data.currency)}
              detail="All saved products"
              icon={Wallet}
              tone="blue"
              className="col-span-2 md:col-span-1"
            />
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
                <div>
                  <h2 className="text-sm font-semibold">Recently added</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">The newest additions to your collection</p>
                </div>
                <Link
                  to="/products"
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary-deep"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.recentlyAdded.length ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {data.recentlyAdded.map((product) => (
                    <MiniProduct key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={Gift}
                    title="Nothing added yet"
                    description="Your most recent finds will appear here."
                    compact
                    action={
                      <Button size="sm" variant="outline" onClick={openQuickAdd}>
                        <Plus className="h-3.5 w-3.5" /> Add product
                      </Button>
                    }
                  />
                </div>
              )}
            </Card>

            <Card className="flex flex-col xl:col-span-4">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
                <div>
                  <h2 className="text-sm font-semibold">Budget overview</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Planned and completed spending</p>
                </div>
                <Link
                  to="/budget"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Open budget"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                {data.budget.budget === null ? (
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-medium">Set a thoughtful budget</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        Track planned purchases and actual spending without double-counting alternative offers.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-5 w-full">
                      <Link to="/budget">Set budget</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Remaining
                        </p>
                        <p
                          className={`mt-1 font-display text-[28px] font-semibold tracking-[-0.03em] ${
                            data.budget.overBudget ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {formatMoney(data.budget.remaining, data.currency)}
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">
                        {data.budget.progress.toFixed(0)}% used
                      </span>
                    </div>
                    <Progress
                      value={data.budget.progress}
                      className="mt-4 h-2"
                      indicatorClassName={data.budget.overBudget ? "bg-destructive" : "bg-primary"}
                    />
                    <div className="mt-5 space-y-3 text-xs">
                      <BudgetRow label="Total budget" value={formatMoney(data.budget.budget, data.currency)} />
                      <BudgetRow label="To buy" value={formatMoney(data.budget.plannedTotal, data.currency)} />
                      <BudgetRow label="Purchased" value={formatMoney(data.budget.purchasedTotal, data.currency)} />
                    </div>
                    <div className="mt-auto pt-5">
                      <Link
                        to="/budget"
                        className="flex items-center justify-between rounded-lg border border-border/80 bg-card px-3 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>Saved product value</span>
                        <span className="font-semibold text-foreground">
                          {formatMoney(data.budget.savedValue, data.currency)}
                        </span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-12">
              <SectionHeading
                title="Favorites"
                subtitle="The ideas you keep coming back to"
                href="/products?status=FAVORITE"
                icon={Heart}
              />
              {data.favorites.length ? (
                <div className="divide-y divide-border/70 px-2 pb-2">
                  {data.favorites.map((product) => (
                    <CompactRow key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="px-4 pb-4">
                  <EmptyState
                    icon={Heart}
                    title="No favorites yet"
                    description="Tap the heart on a product to keep it close."
                    compact
                  />
                </div>
              )}
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
                <div>
                  <h2 className="text-sm font-semibold">Collection at a glance</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">How your saved products are distributed</p>
                </div>
                <Link
                  to="/categories"
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary-deep"
                >
                  Categories <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                {data.categorySummary.length ? (
                  data.categorySummary.map((category) => {
                    const ratio =
                      data.stats.totalProducts > 0 ? (category.count / data.stats.totalProducts) * 100 : 0;
                    return (
                      <div key={category.id}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </span>
                          <span className="text-muted-foreground">
                            {category.count} {category.count === 1 ? "product" : "products"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${ratio}%`, backgroundColor: category.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Categories will appear once you save products.
                  </p>
                )}
              </div>
            </Card>
            <Card className="xl:col-span-4">
              <div className="border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
                <h2 className="text-sm font-semibold">Vault details</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">A quick look at this collection</p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-border/70">
                <VaultFact label="Stores" value={String(data.stats.stores)} />
                <VaultFact label="With prices" value={String(data.stats.withPrice)} />
                <VaultFact label="Purchased value" value={formatCompactMoney(data.budget.purchasedTotal, data.currency)} />
              </div>
              <div className="p-4 sm:p-5">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Last backup
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {meta?.lastBackupAt ? formatDateTime(meta.lastBackupAt) : "No backup yet"}
                  </p>
                  <Button asChild variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[11px]">
                    <Link to="/settings">
                      {meta?.lastBackupAt ? "Manage backups" : "Create a backup"} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Package;
  tone: "neutral" | "rose" | "amber" | "sage" | "blue";
  className?: string;
}) {
  const toneClasses = {
    neutral: "bg-card text-muted-foreground",
    rose: "bg-primary-soft text-primary-deep",
    amber: "bg-warning/10 text-warning",
    sage: "bg-success/10 text-success",
    blue: "bg-info-soft text-info"
  };
  return (
    <Card className={`p-4 transition-shadow hover:shadow-soft ${className ?? ""}`}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.13em] text-muted-foreground">{label}</div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-2.5 font-display text-[26px] font-semibold leading-none tracking-[-0.03em]">{value}</div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{detail}</p>
    </Card>
  );
}

function MiniProduct({ product }: { product: Product }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card p-2.5 transition-all hover:border-border hover:bg-secondary hover:shadow-card"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 sm:h-16 sm:w-16">
        <ProductImage src={product.imageUrl} alt={product.name} iconClassName="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
          <span className="truncate">{product.store?.name ?? "Store"}</span>
          <span>·</span>
          <span className="normal-case tracking-normal">{timeAgo(product.createdAt)}</span>
        </div>
        <h3 className="mt-1 truncate text-[13px] font-medium leading-snug group-hover:text-primary-deep">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{formatMoney(product.currentPrice, product.currency)}</span>
          <StatusBadge status={product.status} className="py-0.5" />
        </div>
      </div>
    </Link>
  );
}

function CompactRow({ product }: { product: Product }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/60"
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
        <ProductImage src={product.imageUrl} alt={product.name} iconClassName="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{product.name}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {product.store?.name ?? "Store"} · {formatDate(product.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold">{formatMoney(product.currentPrice, product.currency)}</p>
        <Heart className="ml-auto mt-1 h-3 w-3 fill-primary text-primary" />
      </div>
    </Link>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
  icon: Icon
}: {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Heart;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Link
        to={href}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={`Open ${title}`}
      >
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function BudgetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function VaultFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        </Card>
        <Card className="p-5 xl:col-span-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-10 w-40" />
          <Skeleton className="mt-4 h-2 w-full" />
          <Skeleton className="mt-5 h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}
