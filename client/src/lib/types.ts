export type ProductStatus = "TO_CONSIDER" | "FAVORITE" | "TO_BUY" | "PURCHASED";

export type Availability = string | null;

export type StoreRef = {
  id: string;
  name: string;
  domain: string;
};

export type CategoryRef = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
};

export type GroupRef = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  url: string;
  normalizedUrl: string;
  description: string | null;
  imageUrl: string | null;
  imageSourceUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  availability: Availability;
  status: ProductStatus;
  notes: string | null;
  store: StoreRef | null;
  category: CategoryRef | null;
  group: GroupRef | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  discountPercent: number | null;
};

export type Category = CategoryRef & {
  isDefault: boolean;
  sortOrder: number;
  productCount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  count: number;
};

export type GroupOffer = {
  id: string;
  name: string;
  url: string;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  availability: string | null;
  imageUrl: string | null;
  store: StoreRef | null;
  status: ProductStatus;
};

export type ProductDetailResponse = {
  product: Product;
  groupOffers: GroupOffer[];
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProductsResponse = {
  products: Product[];
  pagination: Pagination;
};

export type ComparisonOffer = Product & {
  cheapestOfferId?: never;
};

export type ComparisonGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  offers: Product[];
  cheapestOfferId: string | null;
};

export type DashboardData = {
  currency: string;
  stats: {
    totalProducts: number;
    favorites: number;
    toBuy: number;
    purchased: number;
    totalValue: number;
    stores: number;
    withPrice: number;
  };
  recentlyAdded: Product[];
  favorites: Product[];
  categorySummary: Array<{ id: string; name: string; color: string; count: number }>;
  budget: {
    budget: number | null;
    plannedTotal: number;
    purchasedTotal: number;
    savedValue: number;
    remaining: number | null;
    progress: number;
    overBudget: boolean;
  };
};

export type BudgetItem = Product;

export type BudgetSummary = {
  currency: string;
  budget: number | null;
  savedValue: number;
  plannedTotal: number;
  purchasedTotal: number;
  committed: number;
  remaining: number | null;
  progress: number;
  overBudget: boolean;
  plannedItems: BudgetItem[];
  purchasedItems: BudgetItem[];
  unpricedPlanned: number;
  unpricedPurchased: number;
  categoryBreakdown: Array<{
    id: string;
    name: string;
    color: string;
    planned: number;
    purchased: number;
    total: number;
  }>;
};

export type Settings = {
  id: number;
  currency: string;
  defaultProductView: "grid" | "list";
  budget: number | null;
  lastBackupAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

export type SettingsResponse = {
  isOwner: boolean;
  settings: Settings;
  database: {
    path: string;
    size: number;
    uploadsPath: string;
    uploadsSize: number;
    counts: {
      products: number;
      categories: number;
      stores: number;
      groups: number;
      tags: number;
    };
  };
  backups: BackupFile[];
  app: {
    name: string;
    version: string;
    runtime: string;
    storage: string;
    backupDirectory: string;
  };
};

export type ExtractionData = {
  name: string | null;
  url: string;
  storeName: string | null;
  storeDomain: string | null;
  description: string | null;
  imagePath: string | null;
  imageSourceUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  availability: string | null;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
};

export type ExtractionResult = {
  success: boolean;
  data: ExtractionData;
  warnings: string[];
  strategies: string[];
  error?: string;
};

export type AppMeta = {
  productCount: number;
  status: "ok" | "degraded";
  database: "connected" | "error";
  lastBackupAt: string | null;
};

export type ProductInput = {
  name: string;
  url: string;
  description: string | null;
  imagePath: string | null;
  imageSourceUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  availability: string | null;
  status: ProductStatus;
  notes: string | null;
  storeName: string | null;
  storeDomain: string | null;
  categoryId: string;
  groupId: string | null;
  tags: string[];
};
