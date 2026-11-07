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

export type ProductDetailResponse = {
  product: Product;
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

export type DashboardData = {
  currency: string;
  stats: {
    totalProducts: number;
    favorites: number;
    toBuy: number;
    purchased: number;
    totalValue: number;
    withPrice: number;
  };
  recentlyAdded: Product[];
  favorites: Product[];
  categorySummary: Array<{ id: string; name: string; color: string; count: number }>;
};

export type Settings = {
  id: number;
  currency: string;
  defaultProductView: "grid" | "list";
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
  tags: string[];
};
