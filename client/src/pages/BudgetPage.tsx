import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Layers,
  Pencil,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/products/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useBudget } from "@/lib/queries";
import { invalidateVaultData } from "@/lib/invalidate";
import { formatMoney } from "@/lib/format";
import { parsePriceString } from "@/lib/parse";
import type { BudgetItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BudgetPage() {
  const { data, isLoading, isError, refetch } = useBudget();
  const queryClient = useQueryClient();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  useEffect(() => {
    if (data) setBudgetDraft(data.budget !== null ? String(data.budget) : "");
  }, [data?.budget]);

  const budgetMutation = useMutation({
    mutationFn: (budget: number | null) => api.updateSettings({ budget }),
    onSuccess: async () => {
      toast.success("Budget updated");
      setBudgetOpen(false);
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const saveBudget = () => {
    if (!budgetDraft.trim()) {
      budgetMutation.mutate(null);
      return;
    }
    const value = parsePriceString(budgetDraft);
    if (value === null || value < 0) {
      toast.error("Enter a valid budget amount.");
      return;
    }
    budgetMutation.mutate(value);
  };

  const currency = data?.currency ?? "PLN";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Budget"
        description="A calm view of planned gifts and completed purchases. Alternative offers in the same comparison group are counted once, using the cheapest option."
        actions={
          data ? (
            <Button variant="outline" onClick={() => setBudgetOpen(true)}>
              <Pencil className="h-4 w-4" />
              {data.budget === null ? "Set budget" : "Edit budget"}
            </Button>
          ) : null
        }
      />

      {isLoading ? <BudgetSkeleton /> : null}

      {isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">The budget could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check that the local server is running.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {data ? (
        <>
          {data.budget === null ? (
            <Card className="overflow-hidden border-border bg-gradient-to-br bg-card bg-card p-7">
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="max-w-xl">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">Give your gifting a gentle limit.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Set an amount for this season. Gift Vault will compare it with products marked “To buy” and “Purchased”,
                    without double-counting grouped offers.
                  </p>
                  <Button className="mt-5" onClick={() => setBudgetOpen(true)}>
                    <Wallet className="h-4 w-4" /> Set a budget
                  </Button>
                </div>
                <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                  <MiniFact label="Planned" value={formatMoney(data.plannedTotal, currency)} icon={ShoppingBag} />
                  <MiniFact label="Purchased" value={formatMoney(data.purchasedTotal, currency)} icon={BadgeCheck} />
                  <MiniFact label="Saved collection" value={formatMoney(data.savedValue, currency)} icon={Sparkles} />
                  <MiniFact label="To buy" value={String(data.plannedItems.length)} icon={Layers} />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5 text-primary" />
                      Season budget
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <p className="font-display text-[38px] font-semibold leading-none tracking-[-0.04em]">
                        {formatMoney(data.budget, currency)}
                      </p>
                      <Badge variant={data.overBudget ? "destructive" : "success"} className="mb-1">
                        {data.overBudget ? "Over budget" : `${data.progress.toFixed(0)}% committed`}
                      </Badge>
                    </div>
                    <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
                      {data.overBudget
                        ? `You are ${formatMoney(Math.abs(data.remaining ?? 0), currency)} over your budget. Consider moving an item back to “To consider”.`
                        : `${formatMoney(data.remaining, currency)} remains for planned and completed gifts.`}
                    </p>
                  </div>
                  <div className="min-w-[220px] rounded-xl border border-border/80 bg-card p-4">
                    <MiniRow label="Committed" value={formatMoney(data.committed, currency)} strong />
                    <MiniRow label="To buy" value={formatMoney(data.plannedTotal, currency)} />
                    <MiniRow label="Purchased" value={formatMoney(data.purchasedTotal, currency)} />
                    <MiniRow label="Remaining" value={formatMoney(data.remaining, currency)} strong />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{data.progress.toFixed(1)}% of budget committed</span>
                    <span>{formatMoney(Math.min(data.committed, data.budget), currency)} used</span>
                  </div>
                  <Progress
                    value={data.progress}
                    className="h-2.5"
                    indicatorClassName={cn(
                      data.overBudget ? "bg-destructive" : data.progress > 80 ? "bg-warning" : "bg-primary"
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px border-t border-border/70 bg-border/70 sm:grid-cols-4">
                <BudgetFact
                  label="Saved collection"
                  value={formatMoney(data.savedValue, currency)}
                  hint="All products with a price"
                  icon={Sparkles}
                />
                <BudgetFact
                  label="Planned items"
                  value={String(data.plannedItems.length)}
                  hint={data.unpricedPlanned ? `${data.unpricedPlanned} without a price` : "Ready to buy"}
                  icon={ShoppingBag}
                />
                <BudgetFact
                  label="Purchased items"
                  value={String(data.purchasedItems.length)}
                  hint={data.unpricedPurchased ? `${data.unpricedPurchased} without a price` : "Gifts secured"}
                  icon={BadgeCheck}
                />
                <BudgetFact
                  label="Average planned"
                  value={
                    data.plannedItems.length
                      ? formatMoney(data.plannedTotal / data.plannedItems.length, currency)
                      : "—"
                  }
                  hint="Per planned product"
                  icon={CircleDollarSign}
                />
              </div>
            </Card>
          )}

          <section className="grid gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">Planned purchases</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Products marked “To buy”</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/products?status=TO_BUY">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              {data.plannedItems.length ? (
                <div className="divide-y divide-border/70 px-2 pb-2">
                  {data.plannedItems.map((item) => (
                    <BudgetRow key={item.id} item={item} currency={currency} />
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    icon={ShoppingBag}
                    title="Nothing planned yet"
                    description="Set a product’s status to “To buy” and it will appear here."
                    compact
                    action={
                      <Button asChild size="sm" variant="outline">
                        <Link to="/products">Browse products</Link>
                      </Button>
                    }
                  />
                </div>
              )}
            </Card>

            <Card className="xl:col-span-4">
              <div className="border-b border-border/70 px-5 py-4">
                <h2 className="text-sm font-semibold">By category</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Where the budget is going</p>
              </div>
              <div className="space-y-4 p-5">
                {data.categoryBreakdown.length ? (
                  data.categoryBreakdown.map((category) => {
                    const share = data.committed > 0 ? Math.round((category.total / data.committed) * 100) : 0;
                    return (
                      <div key={category.id}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                            {category.name}
                          </span>
                          <span className="text-muted-foreground">{formatMoney(category.total, currency)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${share}%`, backgroundColor: category.color }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>Planned {formatMoney(category.planned, currency)}</span>
                          <span>Purchased {formatMoney(category.purchased, currency)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Categories appear once you plan or purchase a gift.
                  </p>
                )}
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Purchased</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Gifts already secured</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/products?status=PURCHASED">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {data.purchasedItems.length ? (
              <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.purchasedItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/products/${item.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-border hover:bg-secondary hover:shadow-card"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60">
                      <ProductImage src={item.imageUrl} alt={item.name} iconClassName="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium group-hover:text-primary-deep">{item.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {item.category?.name ?? "Uncategorised"} · {item.store?.name ?? "Store"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold">{formatMoney(item.currentPrice, item.currency)}</p>
                      <StatusBadge status={item.status} className="mt-1 py-0 text-[9px]" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState
                  icon={BadgeCheck}
                  title="No purchases yet"
                  description="Mark a product as purchased to keep a record of gifts secured."
                  compact
                />
              </div>
            )}
          </Card>
        </>
      ) : null}

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your budget</DialogTitle>
            <DialogDescription>
              This amount is compared with products marked “To buy” and “Purchased”. Leave it empty to remove the budget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="budget-amount">Budget amount ({currency})</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              placeholder="e.g. 1500"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveBudget();
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Grouped alternative offers count once, using the cheapest available price.
            </p>
          </div>
          <DialogFooter>
            {data?.budget !== null ? (
              <Button
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => budgetMutation.mutate(null)}
                loading={budgetMutation.isPending}
              >
                Remove budget
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBudget} loading={budgetMutation.isPending}>
              Save budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BudgetRow({ item, currency }: { item: BudgetItem; currency: string }) {
  return (
    <Link
      to={`/products/${item.id}`}
      className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/60"
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border/60">
        <ProductImage src={item.imageUrl} alt={item.name} iconClassName="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-medium group-hover:text-primary-deep">{item.name}</p>
          {item.group ? (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">
              Grouped
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {item.category?.name ?? "Uncategorised"} · {item.store?.name ?? "Store"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{formatMoney(item.currentPrice, item.currency || currency)}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{item.availability ?? "No availability"}</p>
      </div>
    </Link>
  );
}

function MiniFact({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-3.5">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function BudgetFact({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <p className="text-[9px] font-medium uppercase tracking-[0.13em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-lg font-semibold tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[280px] rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-[320px] rounded-xl xl:col-span-8" />
        <Skeleton className="h-[320px] rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}
