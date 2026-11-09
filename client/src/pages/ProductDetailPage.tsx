import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Heart,
  ImagePlus,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Trash2,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ProductImage } from "@/components/products/ProductImage";
import { StatusBadge } from "@/components/products/StatusBadge";
import { AvailabilityBadge } from "@/components/products/AvailabilityBadge";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { useProduct } from "@/lib/queries";
import { useToggleFavorite } from "@/hooks/useProductActions";
import { invalidateVaultData } from "@/lib/invalidate";
import { formatDate, formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useProduct(id);
  const toggleFavorite = useToggleFavorite();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const product = data?.product;

  useEffect(() => {
    setNotesDraft(product?.notes ?? "");
  }, [product?.id, product?.notes]);

  const notesMutation = useMutation({
    mutationFn: () => api.updateProduct(product!.id, { notes: notesDraft.trim() || null }),
    onSuccess: async () => {
      toast.success("Notes saved");
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

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError || !product) {
    return (
      <div className="space-y-6" role="main" aria-label="Product not found">
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

  return (
    <div className="space-y-6" role="main" aria-label={product.name}>
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
        {/* Left column: image & notes */}
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
                id="product-notes"
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
        </div>

        {/* Right column: details & price */}
        <div className="space-y-5 xl:col-span-7">
          <Card>
            <div className="border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Product details</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Everything stored locally</p>
              </div>
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

          <Card>
            <div className="border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Current price</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">What this gift costs right now</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
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
                <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-right">
                  <p className="text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Currency</p>
                  <p className="mt-0.5 text-sm font-semibold">{product.currency}</p>
                </div>
              </div>
            </div>
          </Card>

          {product.discountPercent ? (
            <Card className="border-l-2 border-success bg-success/5">
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-success" />
                  <p className="text-sm font-medium text-foreground">
                    {product.discountPercent}% below original price
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
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
        description="The product and its locally stored image will be removed. This cannot be undone."
        confirmLabel="Delete product"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
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
