import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductListRow } from "@/components/products/ProductListRow";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCategories, useProducts, useSettings } from "@/lib/queries";
import { SORT_OPTIONS, STATUS_OPTIONS, STATUS_META } from "@/lib/constants";
import { api } from "@/lib/api";
import { invalidateVaultData } from "@/lib/invalidate";
import { useQuickAdd } from "@/contexts/QuickAddContext";
import type { ProductStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const { openQuickAdd } = useQuickAdd();
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const { data: settingsData } = useSettings();

  const status = (params.get("status") ?? "ALL") as ProductStatus | "ALL";
  const categoryId = params.get("categoryId") ?? "ALL";
  const sort = params.get("sort") ?? "recent";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const search = params.get("search") ?? "";
  const [searchValue, setSearchValue] = useState(search);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [viewInitialized, setViewInitialized] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (viewInitialized) return;
    const saved = localStorage.getItem("gift-vault:view");
    if (saved === "grid" || saved === "list") {
      setView(saved);
      setViewInitialized(true);
    } else if (settingsData?.settings.defaultProductView) {
      setView(settingsData.settings.defaultProductView);
      setViewInitialized(true);
    }
  }, [settingsData, viewInitialized]);

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue === search) return;
      const next = new URLSearchParams(params);
      if (searchValue) next.set("search", searchValue);
      else next.delete("search");
      next.delete("page");
      setParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status,
      categoryId: categoryId === "ALL" ? undefined : categoryId,
      sort,
      page,
      pageSize: 24
    }),
    [search, status, categoryId, sort, page]
  );

  const { data, isLoading, isError, refetch, isFetching } = useProducts(filters);
  const products = data?.products ?? [];
  const pagination = data?.pagination;
  const categories = categoriesData?.categories ?? [];

  useEffect(() => {
    setSelected([]);
  }, [search, status, categoryId, sort, page]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    setParams(next, { replace: true });
  };

  const setViewMode = (nextView: "grid" | "list") => {
    setView(nextView);
    localStorage.setItem("gift-vault:view", nextView);
  };

  const clearFilters = () => {
    setSearchValue("");
    setParams({}, { replace: true });
    setSelected([]);
  };

  const filtersActive = Boolean(search || status !== "ALL" || categoryId !== "ALL" || sort !== "recent");

  const bulkMutation = useMutation({
    mutationFn: (payload: { action: "delete"; ids: string[] } | { action: "status"; ids: string[]; status: ProductStatus }) =>
      api.bulkProducts(payload),
    onSuccess: async (result, variables) => {
      toast.success(
        variables.action === "delete"
          ? `${result.deleted ?? 0} product${(result.deleted ?? 0) === 1 ? "" : "s"} deleted`
          : `${result.updated ?? 0} product${(result.updated ?? 0) === 1 ? "" : "s"} updated`
      );
      setSelected([]);
      setDeleteOpen(false);
      if (variables.action === "delete") setBulkMode(false);
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const allSelected = products.length > 0 && products.every((product) => selected.includes(product.id));
  const someSelected = selected.length > 0;

  const toggleSelection = (id: string, value: boolean) => {
    setSelected((current) => (value ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collection"
        title="All products"
        description={
          pagination
            ? `${pagination.total} saved product${pagination.total === 1 ? "" : "s"}${filtersActive ? " matching your filters" : " in your vault"}.`
            : "Every thoughtful find, organized in one place."
        }
        actions={
          <>
            <Button
              variant={bulkMode ? "soft" : "outline"}
              onClick={() => {
                setBulkMode((current) => !current);
                setSelected([]);
              }}
            >
              <CheckSquare className="h-4 w-4" />
              {bulkMode ? "Done selecting" : "Select"}
            </Button>
            <Button onClick={openQuickAdd}>
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search products, stores, notes or tags…"
              className="h-9 border-border/80 bg-card pl-9 pr-9"
            />
            {searchValue ? (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(value) => updateFilter("status", value)}>
              <SelectTrigger className="h-9 w-full min-w-[120px] sm:w-[138px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryId} onValueChange={(value) => updateFilter("categoryId", value)}>
              <SelectTrigger className="h-9 w-full min-w-[120px] sm:w-[148px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => updateFilter("sort", value)}>
              <SelectTrigger className="h-9 w-full min-w-[120px] sm:w-[160px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}

            <div className="flex h-9 items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Grid view"
              >
                <Grid2X2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {bulkMode ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) =>
                setSelected(checked === true ? products.map((product) => product.id) : [])
              }
              aria-label="Select all products on this page"
            />
            <span className="text-xs font-medium text-primary-deep">
              {selected.length ? `${selected.length} selected` : "Select products to update"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!someSelected} className="bg-card">
                  Move to status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => bulkMutation.mutate({ action: "status", ids: selected, status: option.value })}
                  >
                    <span className={cn("h-2 w-2 rounded-full", STATUS_META[option.value].dotClassName)} />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              disabled={!someSelected}
              className="bg-card text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSelected([]); setBulkMode(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? <ProductsSkeleton view={view} /> : null}

      {isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Products could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">The local API may not be running.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {!isLoading && !isError && products.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={filtersActive ? Search : Plus}
            title={filtersActive ? "No products match these filters" : "Your vault is empty"}
            description={
              filtersActive
                ? "Try a different search term or clear the filters to see everything in your collection."
                : "Add a product from any online store to start building your personal gift collection."
            }
            action={
              filtersActive ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={openQuickAdd}>
                  <Plus className="h-4 w-4" /> Add your first product
                </Button>
              )
            }
          />
        </Card>
      ) : null}

      {!isLoading && products.length > 0 ? (
        <>
          {view === "grid" ? (
            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
                isFetching && "opacity-70 transition-opacity"
              )}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selectable={bulkMode}
                  selected={selected.includes(product.id)}
                  onSelectedChange={(checked) => toggleSelection(product.id, checked)}
                />
              ))}
            </div>
          ) : (
            <div className={cn("space-y-2", isFetching && "opacity-70 transition-opacity")}>
              {products.map((product) => (
                <ProductListRow
                  key={product.id}
                  product={product}
                  selectable={bulkMode}
                  selected={selected.includes(product.id)}
                  onSelectedChange={(checked) => toggleSelection(product.id, checked)}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(pagination.page - 1) * pagination.pageSize + 1}</span>
                –<span className="font-medium text-foreground">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of{" "}
                <span className="font-medium text-foreground">{pagination.total}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1}
                  onClick={() => updateFilter("page", String(page - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => updateFilter("page", String(page + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected.length} product${selected.length === 1 ? "" : "s"}?`}
        description="This removes the products, their price history and locally stored images. This cannot be undone."
        confirmLabel="Delete products"
        loading={bulkMutation.isPending}
        onConfirm={() => bulkMutation.mutate({ action: "delete", ids: selected })}
      />
    </div>
  );
}

function ProductsSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[82px] rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
