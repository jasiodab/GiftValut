import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Heart,
  ImagePlus,
  Layers,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Trash2,
  TrendingDown,
  Upload
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/products/StatusBadge";
import { AvailabilityBadge } from "@/components/products/AvailabilityBadge";
import { PriceChange } from "@/components/products/PriceChange";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { useProduct } from "@/lib/queries";
import { useRefreshPrice, useToggleFavorite } from "@/hooks/useProductActions";
import { invalidateVaultData } from "@/lib/invalidate";
import { CURRENCIES } from "@/lib/constants";
import { formatCompactMoney, formatDate, formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { parsePriceString } from "@/lib/parse";
import type { GroupOffer, PriceHistoryEntry, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type RangeKey = "all" | "90" | "30";

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "all", label: "All time" },
  { key: "90", label: "90 days" },
  { key: "30", label: "30 days" }
];

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useProduct(id);
  const refreshPrice = useRefreshPrice();
  const searchPrices = useMutation({
    mutationFn: () => api.searchPrices(product!.id, true),
    onSuccess: (r:any) => { setOffers(r.offers ?? []); toast.success("Price search completed."); },
    onError: (e: any) => toast.error(e?.message ?? "Price search failed.")
  });
  const toggleFavorite = useToggleFavorite();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [availabilityDraft, setAvailabilityDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("PLN");
  const [notesDraft, setNotesDraft] = useState("");
  const [range, setRange] = useState<RangeKey>("all");

  const product = data?.product;
  const priceHistory = data?.priceHistory ?? [];
  const priceStats = data?.priceStats;
  const groupOffers = data?.groupOffers ?? [];

  useEffect(() => {
    setNotesDraft(product?.notes ?? "");
  }, [product?.id, product?.notes]);

  useEffect(() => {
    if (!product) return;
    setCurrencyDraft(product.currency);
    setPriceDraft(product.currentPrice !== null ? String(product.currentPrice) : "");
    setOriginalDraft(product.originalPrice !== null ? String(product.originalPrice) : "");
    setAvailabilityDraft(product.availability ?? "");
  }, [product?.id, product?.currency, product?.currentPrice, product?.originalPrice, product?.availability]);

  const notesMutation = useMutation({
    mutationFn: () => api.updateProduct(product!.id, { notes: notesDraft.trim() || null }),
    onSuccess: async () => {
      toast.success("Notes saved");
      await invalidateVaultData(queryClient, product!.id);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const trackingMutation = useMutation({
    mutationFn: (autoTrack: boolean) => api.updateProduct(product!.id, { autoTrack }),
    onSuccess: async (result) => {
      toast.success(result.product.autoTrack ? "Automatic tracking enabled" : "Automatic tracking paused");
      await invalidateVaultData(queryClient, product!.id);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const manualMutation = useMutation({
    mutationFn: () => {
      const price = parsePriceString(priceDraft);
      if (price === null || price < 0) throw new Error("Enter a valid price.");
      const originalPrice = originalDraft.trim() ? parsePriceString(originalDraft) : null;
      if (originalPrice !== null && originalPrice < 0) throw new Error("Enter a valid original price.");
      return api.addManualPrice(product!.id, {
        price,
        originalPrice,
        availability: availabilityDraft.trim() || null,
        currency: currencyDraft
      });
    },
    onSuccess: async () => {
      toast.success("Price added to history");
      setManualOpen(false);
      await invalidateVaultData(queryClient, product!.id);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const imageMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await api.uploadImage(file);
      return api.updateProduct(product!.id, {
        imagePath: uploaded.imagePath,
        imageSourceUrl: null
      });
    },
    onSuccess: async () => {
      toast.success("Product image updated");
      await invalidateVaultData(queryClient, product!.id);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const removeImageMutation = useMutation({
    mutationFn: () => api.updateProduct(product!.id, { imagePath: null, imageSourceUrl: null }),
    onSuccess: async () => {
      toast.success("Product image removed");
      await invalidateVaultData(queryClient, product!.id);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProduct(product!.id),
    onSuccess: async () => {
      toast.success("Product deleted");
      await invalidateVaultData(queryClient);
      navigate("/products");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const chartData = useMemo(() => {
    const cutoff =
      range === "all" ? 0 : Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return priceHistory
      .filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff)
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((entry) => ({
        date: entry.recordedAt,
        price: entry.price,
        source: entry.source
      }));
  }, [priceHistory, range]);

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError || !product) {
    return (
      <div className="space-y-6">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All products
        </Link>
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-medium">This product could not be found.</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or the local server is not running.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
            <Button asChild>
              <Link to="/products">Back to products</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isFavorite = product.status === "FAVORITE";
  const notesDirty = notesDraft !== (product.notes ?? "");
  const cheapestOfferId = groupOffers.reduce<string | null>((best, offer) => {
    if (offer.currentPrice === null) return best;
    const bestOffer = groupOffers.find((item) => item.id === best);
    if (!bestOffer || bestOffer.currentPrice === null || offer.currentPrice < bestOffer.currentPrice) {
      return offer.id;
    }
    return best;
  }, null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All products
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <a href={product.url} target="_blank" rel="noreferrer">
              Open store <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button onClick={() => searchPrices.mutate()} disabled={searchPrices.isPending}>
            {searchPrices.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sprawdź najlepszą cenę
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More product actions">
                <span className="text-lg leading-none">···</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setManualOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add a price manually
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => refreshPrice.mutate(product.id)}>
                <RefreshCw className="h-3.5 w-3.5" /> Check store price
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {product.category ? (
              <Link
                to={`/products?categoryId=${product.category.id}`}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-primary-deep"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: product.category.color }} />
                {product.category.name}
              </Link>
            ) : null}
            <span className="text-border">·</span>
            <span className="normal-case tracking-normal">{product.store?.name ?? "Unknown store"}</span>
          </div>
          <h1 className="max-w-3xl font-display text-[30px] font-medium leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[36px]">
            {product.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={product.status} showIcon />
            <AvailabilityBadge availability={product.availability} className="px-1" />
            <span className="text-[11px] text-muted-foreground">Added {formatDate(product.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={isFavorite ? "soft" : "outline"}
            onClick={() => toggleFavorite.mutate({ product })}
            disabled={toggleFavorite.isPending}
          >
            <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
            {isFavorite ? "Favorite" : "Add to favorites"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-5">
          <Card className="overflow-hidden">
            <div className="group relative aspect-[4/3] overflow-hidden bg-card">
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                imageClassName="group-hover:scale-[1.015]"
              />
              {product.discountPercent ? (
                <Badge variant="success" className="absolute left-3 top-3 bg-card/95 text-[10px] shadow-sm">
                  {product.discountPercent}% below original
                </Badge>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t bg-foreground/55 to-transparent p-3 pt-10 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 bg-card/90"
                    onClick={() => fileInputRef.current?.click()}
                    loading={imageMutation.isPending}
                  >
                    {!imageMutation.isPending ? <Upload className="h-3.5 w-3.5" /> : null}
                    Change image
                  </Button>
                  {product.imageUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 bg-card/90 text-destructive hover:text-destructive"
                      onClick={() => removeImageMutation.mutate()}
                      loading={removeImageMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {imageMutation.isPending ? (
                <div className="absolute inset-0 flex items-center justify-center bg-card/65">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) imageMutation.mutate(file);
              }}
            />
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Private notes</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Size, colour, occasion or a quiet hint</p>
              </div>
              {notesDirty ? (
                <Badge variant="warning" className="text-[9px]">
                  Unsaved
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            <div className="p-5">
              <Textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={5}
                placeholder="A thoughtful detail about this gift…"
                className="resize-none bg-card"
                maxLength={5000}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{notesDraft.length} / 5000</span>
                <Button
                  size="sm"
                  onClick={() => notesMutation.mutate()}
                  loading={notesMutation.isPending}
                  disabled={!notesDirty}
                >
                  Save notes
                </Button>
              </div>
            </div>
          </Card>

          {product.description ? (
            <Card>
              <div className="border-b border-border/70 px-5 py-4">
                <h2 className="text-sm font-semibold">Description</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Captured from the store page</p>
              </div>
              <p className="max-h-72 overflow-y-auto whitespace-pre-line px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </Card>
          ) : null}

          <Card>
            <div className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold">Product details</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Everything stored locally</p>
            </div>
            <div className="space-y-4 p-5">
              <DetailRow icon={StoreIcon} label="Store">
                {product.store ? (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:text-primary-deep"
                  >
                    {product.store.name}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow icon={Layers} label="Category">
                {product.category ? (
                  <Link
                    to={`/products?categoryId=${product.category.id}`}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-primary-deep"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: product.category.color }} />
                    {product.category.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow icon={CalendarDays} label="Last checked">
                <span className="font-medium">{product.lastCheckedAt ? timeAgo(product.lastCheckedAt) : "Never"}</span>
                {product.lastCheckStatus === "FAILED" ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> Failed
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow icon={Sparkles} label="Price updated">
                {product.lastPriceCheckAt ? formatDateTime(product.lastPriceCheckAt) : "No price recorded"}
              </DetailRow>
              <DetailRow icon={Tag} label="Tags">
                {product.tags.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <Link
                        key={tag}
                        to={`/products?search=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary-deep"
                      >
                        {tag}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No tags yet</span>
                )}
              </DetailRow>
              <div className="border-t border-border/70 pt-4">
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all rounded-lg border border-border/70 bg-card px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {product.url}
                </a>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-7">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Current price</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {product.lastCheckStatus === "FAILED"
                    ? "Last check failed — the previous valid price is kept"
                    : product.lastPriceCheckAt
                      ? `Checked ${timeAgo(product.lastPriceCheckAt)}`
                      : "No price check yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshPrice.mutate(product.id)}
                  loading={refreshPrice.isPending}
                >
                  {!refreshPrice.isPending ? <RefreshCw className="h-3.5 w-3.5" /> : null}
                  Check price
                </Button>
                <Button size="sm" onClick={() => setManualOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add price
                </Button>
              </div>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-[42px] font-semibold leading-none tracking-[-0.04em]">
                      {formatMoney(product.currentPrice, product.currency)}
                    </span>
                    {product.originalPrice && product.currentPrice !== null && product.originalPrice > product.currentPrice ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatMoney(product.originalPrice, product.currency)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <PriceChange
                      change={product.priceChange}
                      percent={product.priceChangePercent}
                      currency={product.currency}
                      showValue
                      className="text-xs"
                    />
                    {product.previousPrice !== null && product.previousPrice !== product.currentPrice ? (
                      <span className="text-[10px] text-muted-foreground">
                        previous {formatMoney(product.previousPrice, product.currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-right">
                  <p className="text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Currency</p>
                  <p className="mt-0.5 text-sm font-semibold">{product.currency}</p>
                </div>
              </div>

              {product.lastCheckStatus === "FAILED" && product.lastCheckError ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5 text-[11px] leading-relaxed text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{product.lastCheckError}</span>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-card px-4 py-3">
                <div>
                  <p className="text-xs font-medium">Automatic price tracking</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Check this product at the interval set in Settings.
                  </p>
                </div>
                <Switch
                  checked={product.autoTrack}
                  disabled={trackingMutation.isPending}
                  onCheckedChange={(checked) => trackingMutation.mutate(checked)}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PriceFact label="Lowest" value={formatMoney(priceStats?.lowest, product.currency)} tone="sage" />
                <PriceFact label="Highest" value={formatMoney(priceStats?.highest, product.currency)} tone="rose" />
                <PriceFact label="Average" value={formatMoney(priceStats?.average, product.currency)} tone="neutral" />
                <PriceFact label="Records" value={String(priceStats?.entries ?? 0)} tone="blue" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Price history</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {priceStats?.difference !== null && priceStats?.difference !== undefined ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        priceStats.difference < 0 ? "text-success" : priceStats.difference > 0 ? "text-destructive" : ""
                      )}
                    >
                      {priceStats.difference < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : priceStats.difference > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {priceStats.difference === 0
                        ? "No change from previous"
                        : `${priceStats.difference > 0 ? "+" : ""}${formatMoney(priceStats.difference, product.currency)} from previous`}
                    </span>
                  ) : (
                    "Every check and manual update is recorded here"
                  )}
                </p>
              </div>
              <div className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5">
                {RANGES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRange(option.key)}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-[10px] font-medium transition-colors",
                      range === option.key
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {chartData.length ? (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.015} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => shortDate(value as string)}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tickFormatter={(value) => formatCompactMoney(value as number, product.currency)}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                        domain={["auto", "auto"]}
                      />
                      <RechartsTooltip
                        cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          fontSize: 12,
                          boxShadow: "0 8px 24px -14px rgba(51,43,38,0.35)"
                        }}
                        labelFormatter={(value) => formatDateTime(value as string)}
                        formatter={(value) => [formatMoney(Number(value), product.currency), "Price"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#priceFill)"
                        dot={{ r: 2.5, fill: "hsl(var(--card))", stroke: "hsl(var(--primary))", strokeWidth: 1.5 }}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={TrendingDown}
                  title="Not enough history yet"
                  description="Check the store price or add one manually. Each update becomes a point on this chart."
                  compact
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => refreshPrice.mutate(product.id)}>
                        <RefreshCw className="h-3.5 w-3.5" /> Check now
                      </Button>
                      <Button size="sm" onClick={() => setManualOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add price
                      </Button>
                    </div>
                  }
                />
              )}

              <Card className="p-4"><p className="text-xs text-muted-foreground">Price comparison panel</p></Card>

              {priceHistory.length ? (
                <div className="mt-5 border-t border-border/70 pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Recent records
                  </p>
                  <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                    {priceHistory.slice(0, 8).map((entry: PriceHistoryEntry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] hover:bg-secondary/50"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              entry.source === "MANUAL" ? "bg-warning" : "bg-success"
                            )}
                          />
                          {formatDateTime(entry.recordedAt)}
                          <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                            {entry.source === "MANUAL" ? "Manual" : "Automatic"}
                          </span>
                        </span>
                        <span className="font-semibold">{formatMoney(entry.price, entry.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">{product.group ? "Compare offers" : "One gift, several stores"}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {product.group
                    ? `${product.group.name} · ${groupOffers.length} ${groupOffers.length === 1 ? "offer" : "offers"}`
                    : "Group the same product from different stores. Nothing is grouped without your confirmation."}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/comparison">
                  {product.group ? "Manage group" : "Open comparison"} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {product.group && groupOffers.length ? (
              <div className="divide-y divide-border/70 px-2 py-1">
                {groupOffers.map((offer) => (
                  <GroupOfferRow
                    key={offer.id}
                    offer={offer}
                    current={offer.id === product.id}
                    cheapest={offer.id === cheapestOfferId}
                  />
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Is this gift available elsewhere?</p>
                      <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-muted-foreground">
                        Add another product link to this comparison and the budget will count the cheapest option only.
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/comparison?product=${product.id}&create=1`}>
                      <Plus className="h-3.5 w-3.5" /> Create group
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        onSaved={() => {
          void invalidateVaultData(queryClient, product.id);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this product?"
        description="The product, its complete price history and its locally stored image will be removed. This cannot be undone."
        confirmLabel="Delete product"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a price manually</DialogTitle>
            <DialogDescription>
              Use this when a store cannot be read automatically. It becomes the current price and a new point in the
              history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-price">Current price</Label>
                <Input
                  id="manual-price"
                  inputMode="decimal"
                  value={priceDraft}
                  onChange={(event) => setPriceDraft(event.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-original">Original price</Label>
                <Input
                  id="manual-original"
                  inputMode="decimal"
                  value={originalDraft}
                  onChange={(event) => setOriginalDraft(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currencyDraft} onValueChange={setCurrencyDraft}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-availability">Availability</Label>
                <Input
                  id="manual-availability"
                  value={availabilityDraft}
                  onChange={(event) => setAvailabilityDraft(event.target.value)}
                  placeholder="In stock"
                />
              </div>
            </div>
            <p className="rounded-lg border border-border/70 bg-card px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Manual entries are labelled “Manual” in the price history so automatic checks stay distinguishable.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => manualMutation.mutate()}
              loading={manualMutation.isPending}
              disabled={!priceDraft.trim()}
            >
              Add price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children
}: {
  icon: typeof StoreIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  );
}

function PriceFact({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "sage" | "rose" | "neutral" | "blue";
}) {
  const tones = {
    sage: "bg-success/10 text-success",
    rose: "bg-primary-soft text-primary-deep",
    neutral: "bg-card text-muted-foreground",
    blue: "bg-info-soft text-info"
  };
  return (
    <div className={cn("rounded-lg px-3 py-2.5", tones[tone])}>
      <p className="text-[9px] font-medium uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}

function GroupOfferRow({
  offer,
  current,
  cheapest
}: {
  offer: GroupOffer;
  current: boolean;
  cheapest: boolean;
}) {
  return (
    <Link
      to={`/products/${offer.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
        cheapest ? "bg-success/10" : "hover:bg-secondary/50",
        current && "ring-1 ring-inset ring-primary/15"
      )}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
        <ProductImage src={offer.imageUrl} alt={offer.name} iconClassName="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-xs font-medium">{offer.name}</p>
          {current ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
              This product
            </Badge>
          ) : null}
          {cheapest ? (
            <Badge variant="success" className="gap-1 px-1.5 py-0 text-[9px]">
              <Sparkles className="h-2.5 w-2.5" /> Cheapest
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {offer.store?.name ?? "Store"} · {offer.lastPriceCheckAt ? `checked ${timeAgo(offer.lastPriceCheckAt)}` : "not checked"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className={cn("text-sm font-semibold", cheapest && "text-success")}>
            {formatMoney(offer.currentPrice, offer.currency)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{offer.availability ?? "No availability"}</p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
      </div>
    </Link>
  );
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-full max-w-[520px]" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-5">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
        <div className="space-y-5 xl:col-span-7">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
