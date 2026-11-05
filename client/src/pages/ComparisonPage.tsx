import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  GitCompareArrows,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useGroups, useProduct, useProducts } from "@/lib/queries";
import { invalidateVaultData } from "@/lib/invalidate";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ComparisonGroup, Product } from "@/lib/types";

export function ComparisonPage() {
  const { data, isLoading } = useGroups();
  const { data: productsData } = useProducts({ pageSize: 100, sort: "recent" });
  const [params, setParams] = useSearchParams();
  const presetId = params.get("product");
  const shouldCreate = params.get("create") === "1";
  const { data: presetData } = useProduct(presetId ?? undefined);
  const presetProduct = presetData?.product ?? null;

  const queryClient = useQueryClient();
  const presetHandled = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<ComparisonGroup | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ComparisonGroup | null>(null);
  const [addTarget, setAddTarget] = useState<ComparisonGroup | null>(null);
  const [addProductId, setAddProductId] = useState("");

  const groups = data?.groups ?? [];
  const allProducts = productsData?.products ?? [];
  const ungrouped = useMemo(() => allProducts.filter((product) => !product.group), [allProducts]);

  const summary = useMemo(() => {
    const offers = groups.reduce((sum, group) => sum + group.offers.length, 0);
    const savings = groups.reduce((sum, group) => {
      const prices = group.offers.map((offer) => offer.currentPrice).filter((price): price is number => price !== null);
      if (prices.length < 2) return sum;
      return sum + (Math.max(...prices) - Math.min(...prices));
    }, 0);
    return { offers, savings };
  }, [groups]);

  useEffect(() => {
    if (presetHandled.current || !shouldCreate || !presetId) return;
    presetHandled.current = true;
    setCreateOpen(true);
    setSelectedIds([presetId]);
    setGroupName(presetProduct ? `${presetProduct.name} — offers` : "");
    const next = new URLSearchParams(params);
    next.delete("create");
    setParams(next, { replace: true });
  }, [shouldCreate, presetId, presetProduct, params, setParams]);

  useEffect(() => {
    if (!presetHandled.current || !presetId || !presetProduct) return;
    setGroupName((current) => current || `${presetProduct.name} — offers`);
    const next = new URLSearchParams(params);
    next.delete("product");
    setParams(next, { replace: true });
  }, [presetId, presetProduct, params, setParams]);

  const createMutation = useMutation({
    mutationFn: () => api.createGroup({ name: groupName.trim(), productIds: selectedIds }),
    onSuccess: async () => {
      toast.success("Comparison group created");
      closeCreate();
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateGroup(id, { name }),
    onSuccess: async () => {
      toast.success("Comparison group renamed");
      setRenameTarget(null);
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGroup(id),
    onSuccess: async () => {
      toast.success("Comparison group deleted. Its products were kept.");
      setDeleteTarget(null);
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const addMutation = useMutation({
    mutationFn: ({ groupId, productId }: { groupId: string; productId: string }) =>
      api.addGroupOffer(groupId, productId),
    onSuccess: async () => {
      toast.success("Offer added to the group");
      setAddTarget(null);
      setAddProductId("");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const removeMutation = useMutation({
    mutationFn: ({ groupId, productId }: { groupId: string; productId: string }) =>
      api.removeGroupOffer(groupId, productId),
    onSuccess: async () => {
      toast.success("Offer removed from the group");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const closeCreate = () => {
    setCreateOpen(false);
    setGroupName("");
    setSelectedIds([]);
    setCandidateSearch("");
  };

  const toggleProduct = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  };

  const candidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();
    return ungrouped.filter((product) => {
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        (product.store?.name ?? "").toLowerCase().includes(query) ||
        (product.category?.name ?? "").toLowerCase().includes(query)
      );
    });
  }, [ungrouped, candidateSearch]);

  const openAdd = (group: ComparisonGroup) => {
    setAddTarget(group);
    const first = ungrouped[0];
    setAddProductId(first?.id ?? "");
  };

  const addCandidates = useMemo(
    () => ungrouped.filter((product) => !addTarget?.offers.some((offer) => offer.id === product.id)),
    [ungrouped, addTarget]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Price comparison"
        description="Keep the same gift from different stores side by side. Grouped alternatives count once in your budget, using the cheapest available price."
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true);
              setSelectedIds([]);
              setGroupName("");
            }}
          >
            <Plus className="h-4 w-4" /> New comparison
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryFact label="Comparison groups" value={String(groups.length)} hint="Independent gift decisions" icon={Layers} />
        <SummaryFact
          label="Offers compared"
          value={String(summary.offers)}
          hint="Products across all groups"
          icon={GitCompareArrows}
        />
        <SummaryFact
          label="Potential savings"
          value={formatMoney(summary.savings, "PLN")}
          hint="Choosing the cheapest offer"
          icon={Sparkles}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[220px] rounded-xl" />
          ))}
        </div>
      ) : null}

      {!isLoading && groups.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={GitCompareArrows}
            title="No comparisons yet"
            description="Group the same product from different stores to see which offer is cheapest. Nothing is grouped automatically — you stay in control."
            action={
              <Button
                onClick={() => {
                  setCreateOpen(true);
                  setSelectedIds([]);
                  setGroupName("");
                }}
              >
                <Plus className="h-4 w-4" /> Create your first comparison
              </Button>
            }
          />
        </Card>
      ) : null}

      {!isLoading && groups.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => {
            const prices = group.offers
              .map((offer) => offer.currentPrice)
              .filter((price): price is number => price !== null);
            const spread = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
            return (
              <Card key={group.id} className="flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold">{group.name}</h2>
                      <Badge variant="secondary" className="px-2 py-0 text-[9px]">
                        {group.offers.length} {group.offers.length === 1 ? "offer" : "offers"}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Updated {timeAgo(group.updatedAt)}</span>
                      {spread > 0 ? (
                        <>
                          <span className="text-border">·</span>
                          <span className="inline-flex items-center gap-1 text-success">
                            <ArrowDownRight className="h-3 w-3" />
                            {formatMoney(spread, group.offers[0]?.currency ?? "PLN")} spread
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${group.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(group);
                          setRenameName(group.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Rename group
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAdd(group)}>
                        <Plus className="h-3.5 w-3.5" /> Add an offer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {group.offers.length ? (
                  <div className="divide-y divide-border/70 px-2">
                    {group.offers.map((offer) => (
                      <OfferRow
                        key={offer.id}
                        offer={offer}
                        cheapest={offer.id === group.cheapestOfferId}
                        removing={removeMutation.isPending}
                        onRemove={() => removeMutation.mutate({ groupId: group.id, productId: offer.id })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs text-muted-foreground">This group has no offers right now.</p>
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 bg-card/70 px-5 py-3">
                  <Button variant="ghost" size="sm" onClick={() => openAdd(group)}>
                    <Plus className="h-3.5 w-3.5" /> Add offer
                  </Button>
                  {group.cheapestOfferId ? (
                    <Link
                      to={`/products/${group.cheapestOfferId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary-deep"
                    >
                      View cheapest offer <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Add prices to compare</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate();
          else setCreateOpen(true);
        }}
      >
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/80 px-6 py-5">
            <DialogTitle>New comparison group</DialogTitle>
            <DialogDescription>
              Pick two or more products that represent the same gift. Only products that are not already grouped can be
              added.
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="e.g. Wireless headphones"
              />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Label>Choose offers</Label>
              <span className="text-[11px] text-muted-foreground">
                {selectedIds.length} selected
              </span>
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder="Search ungrouped products…"
                className="pl-9"
              />
            </div>

            <div className="scrollbar-thin mt-3 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {candidates.length ? (
                candidates.map((product) => {
                  const selected = selectedIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id, !selected)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                        selected
                          ? "border-primary/40 bg-primary-soft/60"
                          : "border-border/70 bg-card hover:bg-secondary/40"
                      )}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60">
                        <ProductImage src={product.imageUrl} alt={product.name} iconClassName="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{product.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {product.store?.name ?? "Store"} · {formatMoney(product.currentPrice, product.currency)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  {ungrouped.length
                    ? "No ungrouped products match that search."
                    : "Every product is already in a comparison group."}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border/80 bg-card px-6 py-4">
            <Button variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!groupName.trim() || selectedIds.length < 2}
            >
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename comparison</DialogTitle>
            <DialogDescription>Give this group a name that makes the gift easy to recognise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-group">Group name</Label>
            <Input
              id="rename-group"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={renameMutation.isPending}
              disabled={!renameName.trim()}
              onClick={() => {
                if (!renameTarget) return;
                renameMutation.mutate({ id: renameTarget.id, name: renameName.trim() });
              }}
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(addTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setAddTarget(null);
            setAddProductId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an offer</DialogTitle>
            <DialogDescription>
              Add another product to “{addTarget?.name}”. It will be removed from its current place only if you confirm by
              adding it here.
            </DialogDescription>
          </DialogHeader>
          {addCandidates.length ? (
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {addCandidates.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} · {formatMoney(product.currentPrice, product.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              No other ungrouped products are available. Add a new product first.
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddTarget(null);
                setAddProductId("");
              }}
            >
              Cancel
            </Button>
            <Button
              loading={addMutation.isPending}
              disabled={!addProductId || !addTarget}
              onClick={() => {
                if (!addTarget || !addProductId) return;
                addMutation.mutate({ groupId: addTarget.id, productId: addProductId });
              }}
            >
              Add offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete “${deleteTarget?.name ?? "comparison"}”?`}
        description="The group is removed, but every product and its price history stays in your vault. They simply become ungrouped."
        confirmLabel="Delete group"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function OfferRow({
  offer,
  cheapest,
  removing,
  onRemove
}: {
  offer: Product;
  cheapest: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
        cheapest ? "bg-success/10" : "hover:bg-secondary/50"
      )}
    >
      <Link
        to={`/products/${offer.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${offer.name}`}
      />
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border/60">
        <ProductImage src={offer.imageUrl} alt={offer.name} iconClassName="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-medium">{offer.name}</p>
          {cheapest ? (
            <Badge variant="success" className="shrink-0 gap-1 px-1.5 py-0 text-[9px]">
              <Sparkles className="h-2.5 w-2.5" /> Cheapest
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {offer.store?.name ?? "Store"} · {offer.availability ?? "No availability"}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold", cheapest && "text-success")}>
          {formatMoney(offer.currentPrice, offer.currency)}
        </p>
        <StatusBadge status={offer.status} className="mt-1 py-0 text-[9px]" />
      </div>
      <div className="z-20 flex items-center gap-0.5">
        <a
          href={offer.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Open ${offer.name} in store`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          disabled={removing}
          onClick={onRemove}
          aria-label={`Remove ${offer.name} from group`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SummaryFact({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Layers;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-[24px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </Card>
  );
}
