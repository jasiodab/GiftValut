import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CakeSlice,
  Flower2,
  Gamepad2,
  Gem,
  Gift,
  Headphones,
  Lamp,
  MoreHorizontal,
  Pencil,
  Plus,
  Shirt,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  type LucideIcon
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
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useCategories, useDashboard } from "@/lib/queries";
import { invalidateVaultData } from "@/lib/invalidate";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Tag,
  Gem,
  Sparkles,
  Shirt,
  Headphones,
  Gamepad2,
  BookOpen,
  Lamp,
  Flower2,
  Ticket,
  CakeSlice,
  Gift
};

type EditorState = {
  open: boolean;
  category: Category | null;
  name: string;
  color: string;
  icon: string;
};

const emptyEditor = (): EditorState => ({
  open: false,
  category: null,
  name: "",
  color: CATEGORY_COLORS[0],
  icon: "Tag"
});

export function CategoriesPage() {
  const { data, isLoading } = useCategories();
  const { data: dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const categories = data?.categories ?? [];
  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + category.productCount, 0),
    [categories]
  );
  const totalValue = useMemo(
    () => categories.reduce((sum, category) => sum + category.totalValue, 0),
    [categories]
  );

  const saveMutation = useMutation({
    mutationFn: (state: EditorState) => {
      const body = { name: state.name.trim(), color: state.color, icon: state.icon };
      if (state.category) return api.updateCategory(state.category.id, body);
      return api.createCategory(body);
    },
    onSuccess: async () => {
      toast.success(editor.category ? "Category updated" : "Category created");
      setEditor(emptyEditor());
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: async () => {
      toast.success("Category deleted");
      setDeleteTarget(null);
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const openCreate = () =>
    setEditor({
      open: true,
      category: null,
      name: "",
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      icon: "Gift"
    });

  const openEdit = (category: Category) =>
    setEditor({
      open: true,
      category,
      name: category.name,
      color: category.color,
      icon: category.icon
    });

  const canSave = editor.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Categories"
        description="A quiet structure for everything you save. Categories keep your collection easy to browse and your budget easy to understand."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryFact label="Categories" value={String(categories.length)} hint="In your collection" />
        <SummaryFact label="Categorised products" value={String(totalProducts)} hint="Across every category" />
        <SummaryFact
          label="Categorised value"
          value={formatMoney(totalValue, dashboard?.currency ?? "PLN")}
          hint="Estimated current prices"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[168px] rounded-xl" />
          ))}
        </div>
      ) : null}

      {!isLoading && categories.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={Tag}
            title="No categories yet"
            description="Create your first category to start organising the collection."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Create category
              </Button>
            }
          />
        </Card>
      ) : null}

      {!isLoading && categories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const Icon = ICON_MAP[category.icon] ?? Tag;
            const share = totalProducts > 0 ? Math.round((category.productCount / totalProducts) * 100) : 0;
            return (
              <Card key={category.id} className="group relative overflow-hidden p-5 transition-all hover:border-border hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/products?categoryId=${category.id}`} className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/30"
                      style={{ backgroundColor: `${category.color}22`, color: category.color }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold transition-colors group-hover:text-primary-deep">
                          {category.name}
                        </h2>
                        {category.isDefault ? (
                          <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {category.productCount} {category.productCount === 1 ? "product" : "products"} ·{" "}
                        {share}% of collection
                      </p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${category.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(category)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit category
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={category.slug === "other"}
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(category)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete category
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
                      Current value
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">
                      {formatMoney(category.totalValue, dashboard?.currency ?? "PLN")}
                    </p>
                  </div>
                  <Link
                    to={`/products?categoryId=${category.id}`}
                    className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary-deep"
                  >
                    View products
                  </Link>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${category.productCount > 0 ? Math.max(share, 4) : 0}%`,
                      backgroundColor: category.color
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) setEditor(emptyEditor());
          else setEditor((current) => ({ ...current, open: true }));
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor.category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              Pick a name, a soft accent colour and an icon that makes this group easy to spot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={editor.name}
                maxLength={40}
                onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Home & Decor"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Accent colour</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditor((current) => ({ ...current, color }))}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 border-transparent transition-transform hover:scale-110",
                      editor.color === color && "border-foreground/60 ring-2 ring-foreground/30"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Use colour ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 gap-2">
                {CATEGORY_ICONS.map((iconName) => {
                  const Icon = ICON_MAP[iconName] ?? Tag;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setEditor((current) => ({ ...current, icon: iconName }))}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg border transition-colors",
                        editor.icon === iconName
                          ? "border-primary/40 bg-primary-soft text-primary-deep"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary"
                      )}
                      aria-label={iconName}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(emptyEditor())}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editor)}
              loading={saveMutation.isPending}
              disabled={!canSave}
            >
              {editor.category ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete “${deleteTarget?.name ?? "category"}”?`}
        description={
          deleteTarget?.productCount
            ? "This category still contains products. Move them to another category before deleting it."
            : "This only removes the category. Products and price history are not affected."
        }
        confirmLabel="Delete category"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function SummaryFact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </Card>
  );
}
