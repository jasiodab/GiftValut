import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  Wand2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useCategories, useSettings, useTags } from "@/lib/queries";
import { invalidateVaultData } from "@/lib/invalidate";
import { CURRENCIES, STATUS_OPTIONS } from "@/lib/constants";
import type { ExtractionData, Product, ProductInput, ProductStatus } from "@/lib/types";
import { parsePriceString } from "@/lib/parse";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { ProductImage } from "./ProductImage";

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSaved?: (product: Product) => void;
  defaultCategoryId?: string;
};

type FormState = {
  name: string;
  url: string;
  description: string;
  imagePath: string;
  imageSourceUrl: string;
  currentPrice: string;
  originalPrice: string;
  currency: string;
  availability: string;
  status: ProductStatus;
  categoryId: string;
  notes: string;
  storeName: string;
  storeDomain: string;
  tags: string[];
};

const emptyForm = (currency: string): FormState => ({
  name: "",
  url: "",
  description: "",
  imagePath: "",
  imageSourceUrl: "",
  currentPrice: "",
  originalPrice: "",
  currency,
  availability: "",
  status: "TO_CONSIDER",
  categoryId: "",
  notes: "",
  storeName: "",
  storeDomain: "",
  tags: []
});

function formFromProduct(product: Product): FormState {
  return {
    name: product.name,
    url: product.url,
    description: product.description ?? "",
    imagePath: product.imageUrl ?? "",
    imageSourceUrl: product.imageSourceUrl ?? "",
    currentPrice: product.currentPrice !== null ? String(product.currentPrice) : "",
    originalPrice: product.originalPrice !== null ? String(product.originalPrice) : "",
    currency: product.currency,
    availability: product.availability ?? "",
    status: product.status,
    categoryId: product.category?.id ?? "",
    notes: product.notes ?? "",
    storeName: product.store?.name ?? "",
    storeDomain: product.store?.domain ?? "",
    tags: product.tags
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
  defaultCategoryId
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(product);
  const { data: categoriesData } = useCategories();
  const { data: tagsData } = useTags();
  const { data: settingsData } = useSettings();
  const categories = categoriesData?.categories ?? [];
  const knownTags = tagsData?.tags ?? [];

  const [form, setForm] = useState<FormState>(emptyForm("PLN"));
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<{
    success: boolean;
    error?: string;
    warnings: string[];
    strategies: string[];
  } | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settings = settingsData?.settings;

  useEffect(() => {
    if (!open) return;
    const defaultCurrency = settings?.currency ?? "PLN";
    if (product) {
      setForm(formFromProduct(product));
      setDetailsVisible(true);
    } else {
      const otherCategory =
        categories.find((category) => category.slug === "other") ?? categories[0] ?? null;
      setForm({
        ...emptyForm(defaultCurrency),
        categoryId: defaultCategoryId ?? otherCategory?.id ?? ""
      });
      setDetailsVisible(false);
    }
    setExtraction(null);
    setDuplicate(null);
    setFormError(null);
    setErrors({});
    setTagDraft("");
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || detailsVisible) return;
    if (form.categoryId) return;
    const other = categories.find((category) => category.slug === "other") ?? categories[0];
    if (other) setForm((current) => ({ ...current, categoryId: other.id }));
  }, [categories, open, detailsVisible, form.categoryId]);

  useEffect(() => {
    if (!open || !form.url.trim() || !/^https?:\/\//i.test(form.url.trim())) {
      setDuplicate(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const result = await api.checkDuplicate(form.url);
        if (cancelled) return;
        if (result.duplicate && result.duplicate.id !== product?.id) {
          setDuplicate({ id: result.duplicate.id, name: result.duplicate.name });
        } else {
          setDuplicate(null);
        }
      } catch {
        // A duplicate check should never block typing.
      }
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [form.url, open, product?.id]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ProductInput) => {
      if (product) return api.updateProduct(product.id, payload);
      return api.createProduct(payload);
    },
    onSuccess: async (result) => {
      toast.success(isEditing ? "Product updated" : "Product added to your vault");
      await invalidateVaultData(queryClient, result.product.id);
      onSaved?.(result.product);
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setFormError(error.message);
        if (error.code === "DUPLICATE_PRODUCT" && error.details) {
          const details = error.details as { productId?: string; productName?: string };
          if (details.productId) setDuplicate({ id: details.productId, name: details.productName ?? "Existing product" });
        }
      } else {
        setFormError(error instanceof Error ? error.message : "Could not save this product.");
      }
    }
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const applyExtraction = (data: ExtractionData) => {
    setForm((current) => ({
      ...current,
      url: data.url || current.url,
      name: data.name ?? current.name,
      description: data.description ?? current.description,
      imagePath: data.imagePath ?? current.imagePath,
      imageSourceUrl: data.imageSourceUrl ?? current.imageSourceUrl,
      currentPrice: data.currentPrice !== null ? String(data.currentPrice) : current.currentPrice,
      originalPrice: data.originalPrice !== null ? String(data.originalPrice) : current.originalPrice,
      currency: data.currency || current.currency,
      availability: data.availability ?? current.availability,
      storeName: data.storeName ?? current.storeName,
      storeDomain: data.storeDomain ?? current.storeDomain,
      categoryId: data.suggestedCategoryId ?? current.categoryId
    }));
  };

  const handleExtract = async () => {
    const url = form.url.trim();
    if (!url) {
      setErrors((current) => ({ ...current, url: "Paste a product link first." }));
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setErrors((current) => ({ ...current, url: "Use a full link starting with http:// or https://." }));
      return;
    }

    setExtracting(true);
    setExtraction(null);
    setFormError(null);
    try {
      const result = await api.extract(url);
      setExtraction({
        success: result.success,
        error: result.error,
        warnings: result.warnings,
        strategies: result.strategies
      });
      applyExtraction(result.data);
      setDetailsVisible(true);
      if (result.success) {
        toast.success("Product details found");
      } else {
        toast.warning("Automatic extraction was limited", {
          description: "The form is open so you can fill in the details manually."
        });
      }
    } catch (error) {
      setExtraction({
        success: false,
        error: error instanceof Error ? error.message : "The product could not be read.",
        warnings: ["You can still add the product manually."],
        strategies: []
      });
      setDetailsVisible(true);
      toast.error("Could not read this link", {
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    setUploadingImage(true);
    try {
      const result = await api.uploadImage(file);
      update("imagePath", result.imagePath);
      update("imageSourceUrl", "");
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addTag = () => {
    const parts = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!parts.length) {
      setTagDraft("");
      return;
    }
    const next = [...form.tags];
    for (const part of parts) {
      if (next.some((tag) => tag.toLowerCase() === part.toLowerCase())) continue;
      next.push(part.slice(0, 40));
    }
    if (next.length > 15) {
      toast.error("You can add up to 15 tags.");
      update("tags", next.slice(0, 15));
      setTagDraft("");
      return;
    }
    update("tags", next);
    setTagDraft("");
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Product name is required.";
    if (!form.url.trim()) next.url = "Product URL is required.";
    else if (!/^https?:\/\//i.test(form.url.trim())) next.url = "Use a full HTTP or HTTPS link.";
    if (!form.categoryId) next.categoryId = "Choose a category.";
    if (form.currentPrice.trim()) {
      const value = parsePriceString(form.currentPrice);
      if (value === null || value < 0) next.currentPrice = "Enter a valid price.";
    }
    if (form.originalPrice.trim()) {
      const value = parsePriceString(form.originalPrice);
      if (value === null || value < 0) next.originalPrice = "Enter a valid original price.";
    }
    if (duplicate) next.url = "This URL is already in your vault.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    setFormError(null);
    if (!validate()) return;

    const payload: ProductInput = {
      name: form.name.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      imagePath: form.imagePath || null,
      imageSourceUrl: form.imageSourceUrl || null,
      currentPrice: form.currentPrice.trim() ? parsePriceString(form.currentPrice) : null,
      originalPrice: form.originalPrice.trim() ? parsePriceString(form.originalPrice) : null,
      currency: form.currency,
      availability: form.availability.trim() || null,
      status: form.status,
      categoryId: form.categoryId,
      notes: form.notes.trim() || null,
      storeName: form.storeName.trim() || null,
      storeDomain: form.storeDomain.trim() || null,
      tags: form.tags
    };
    saveMutation.mutate(payload);
  };

  const suggestedTags = useMemo(
    () =>
      knownTags
        .filter((tag) => !form.tags.some((existing) => existing.toLowerCase() === tag.name.toLowerCase()))
        .slice(0, 5),
    [knownTags, form.tags]
  );

  const field = (key: "name" | "description" | "storeName" | "availability" | "notes") => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(key, event.target.value)
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[92vh]">
        <DialogHeader className="border-b border-border/80 px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {isEditing ? "Edit product" : "New addition"}
          </div>
          <DialogTitle>{isEditing ? "Edit product details" : "Add to your vault"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details and pricing for this product."
              : "Paste a store link and we’ll try to fill in the details. You stay in control of what is saved."}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <Label htmlFor="product-url" className="mb-2 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                Product link
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="product-url"
                  value={form.url}
                  onChange={(event) => {
                    update("url", event.target.value);
                    if (!detailsVisible) setDetailsVisible(false);
                  }}
                  placeholder="https://store.com/product/..."
                  className={cn("h-10 bg-card", errors.url && "border-destructive focus-visible:ring-destructive/30")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleExtract();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void handleExtract()}
                  loading={extracting}
                  className="h-10 shrink-0"
                >
                  {!extracting ? <Wand2 className="h-4 w-4" /> : null}
                  {extracting ? "Reading page" : "Fetch details"}
                </Button>
              </div>
              {errors.url ? <p className="mt-1.5 text-xs text-destructive">{errors.url}</p> : null}
              {!detailsVisible ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Stores may block automated reading. You can always enter details by hand.
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDetailsVisible(true)}>
                    Add manually <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>

            {duplicate ? (
              <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-3.5 text-warning">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 text-xs leading-relaxed">
                  <p className="font-medium">This product is already in your vault.</p>
                  <p className="mt-0.5 truncate">{duplicate.name}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 bg-card/70">
                  <Link to={`/products/${duplicate.id}`} onClick={() => onOpenChange(false)}>
                    Open
                  </Link>
                </Button>
              </div>
            ) : null}

            {extraction ? (
              <div
                className={cn(
                  "rounded-xl border p-4",
                  extraction.success
                    ? "border-success/20 bg-success/10"
                    : "border-warning/20 bg-warning/10"
                )}
              >
                <div className="flex items-start gap-3">
                  {extraction.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", extraction.success ? "text-success" : "text-warning")}>
                      {extraction.success ? "Details found — review before saving" : extraction.error ?? "Limited details found"}
                    </p>
                    {extraction.strategies.length ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                        <Sparkles className="h-3 w-3" />
                        Detected with {extraction.strategies.join(" · ")}
                      </p>
                    ) : null}
                    {extraction.warnings.length ? (
                      <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-warning">
                        {extraction.warnings.map((warning) => (
                          <li key={warning} className="flex items-start gap-1.5">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {detailsVisible ? (
              <div className="animate-slide-up space-y-6">
                {formError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                    {formError}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
                  <div>
                    <Label className="mb-2 block">Product image</Label>
                    <div className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
                      <ProductImage src={form.imagePath} alt="Product preview" iconClassName="h-6 w-6" />
                      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t bg-foreground/40 via-transparent p-2 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 bg-card/90 px-2 text-[11px]"
                            loading={uploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {!uploadingImage ? <Upload className="h-3 w-3" /> : null}
                            Upload
                          </Button>
                          {form.imagePath ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="secondary"
                              className="h-7 w-7 bg-card/90"
                              onClick={() => {
                                update("imagePath", "");
                                update("imageSourceUrl", "");
                              }}
                              aria-label="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {uploadingImage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-card/70">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
                        if (file) void handleImageUpload(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => fileInputRef.current?.click()}
                      loading={uploadingImage}
                    >
                      {!uploadingImage ? <ImagePlus className="h-3.5 w-3.5" /> : null}
                      Change image
                    </Button>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                      Images are stored locally. Max 8 MB.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="product-name">Name *</Label>
                      <Input
                        id="product-name"
                        {...field("name")}
                        placeholder="What is this product?"
                        className={errors.name ? "border-destructive" : ""}
                      />
                      {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="product-description">Description</Label>
                      <Textarea
                        id="product-description"
                        {...field("description")}
                        placeholder="Optional details, size, colour, variant…"
                        rows={3}
                        className="resize-none bg-card"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="product-price">Current price</Label>
                        <Input
                          id="product-price"
                          inputMode="decimal"
                          value={form.currentPrice}
                          onChange={(event) => update("currentPrice", event.target.value)}
                          placeholder="0.00"
                          className={errors.currentPrice ? "border-destructive" : ""}
                        />
                        {errors.currentPrice ? <p className="text-xs text-destructive">{errors.currentPrice}</p> : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="product-original-price">Original price</Label>
                        <Input
                          id="product-original-price"
                          inputMode="decimal"
                          value={form.originalPrice}
                          onChange={(event) => update("originalPrice", event.target.value)}
                          placeholder="Optional"
                          className={errors.originalPrice ? "border-destructive" : ""}
                        />
                        {errors.originalPrice ? <p className="text-xs text-destructive">{errors.originalPrice}</p> : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <Select value={form.currency} onValueChange={(value) => update("currency", value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select
                          value={form.status}
                          onValueChange={(value) => update("status", value as ProductStatus)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/70 pt-5">
                  <h3 className="mb-4 text-sm font-semibold">Organisation</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Category *</Label>
                      <Select value={form.categoryId} onValueChange={(value) => update("categoryId", value)}>
                        <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                {category.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.categoryId ? <p className="text-xs text-destructive">{errors.categoryId}</p> : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="store-name">Store</Label>
                      <Input
                        id="store-name"
                        {...field("storeName")}
                        placeholder="Store name"
                        className="bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="availability">Availability</Label>
                      <Input
                        id="availability"
                        {...field("availability")}
                        placeholder="In stock, pre-order…"
                        className="bg-card"
                      />
                    </div>

                  </div>

                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="product-tags">Tags</Label>
                    <div className="rounded-md border border-input bg-card p-2 focus-within:ring-2 focus-within:ring-ring/30">
                      {form.tags.length ? (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {form.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium"
                            >
                              {tag}
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => update("tags", form.tags.filter((item) => item !== tag))}
                                aria-label={`Remove ${tag}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <input
                        id="product-tags"
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addTag();
                          }
                          if (event.key === "Backspace" && !tagDraft && form.tags.length) {
                            update("tags", form.tags.slice(0, -1));
                          }
                        }}
                        onBlur={() => {
                          if (tagDraft.trim()) addTag();
                        }}
                        placeholder="Type a tag and press Enter"
                        className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    {suggestedTags.length ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground">Suggestions:</span>
                        {suggestedTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => update("tags", [...form.tags, tag.name])}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            + {tag.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="product-notes">Private notes</Label>
                    <Textarea
                      id="product-notes"
                      {...field("notes")}
                      placeholder="Gift idea for…, size, colour preference, occasion…"
                      rows={3}
                      className="resize-none bg-card"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-border/80 bg-card px-4 py-4 sm:px-6">
          {detailsVisible ? (
            <div className="mr-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <Sparkles className="h-3 w-3" />
              Review extracted details before saving
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={saveMutation.isPending}
            disabled={!detailsVisible || Boolean(duplicate)}
          >
            {!saveMutation.isPending ? <Plus className="h-4 w-4" /> : null}
            {isEditing ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
