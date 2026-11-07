import type {
  AppMeta,
  Category,
  DashboardData,
  ExtractionResult,
  Pagination,
  Product,
  ProductDetailResponse,
  ProductInput,
  ProductsResponse,
  ProductStatus,
  Settings,
  SettingsResponse,
  Tag
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = "API_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const body: BodyInit | undefined = isFormData
    ? (options.body as FormData)
    : options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined;
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: isFormData ? undefined : options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body,
    signal: options.signal
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const error = (payload as { error?: { message?: string; code?: string; details?: unknown } } | null)?.error;
    const isAuthProbe =
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/me") ||
      path.startsWith("/auth/bootstrap") ||
      path.startsWith("/auth/invite/accept");
    if (response.status === 401 && !isAuthProbe && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gv:unauthorized"));
    }
    throw new ApiError(
      response.status,
      error?.message ?? `Request failed with HTTP ${response.status}.`,
      error?.code ?? "API_ERROR",
      error?.details
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type ProductFilters = {
  search?: string;
  status?: ProductStatus | "ALL";
  categoryId?: string;
  favorite?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export const api = {
  meta: (signal?: AbortSignal) => request<AppMeta>("/meta", { signal }),
  dashboard: (signal?: AbortSignal) => request<DashboardData>("/dashboard", { signal }),

  products: (filters: ProductFilters = {}, signal?: AbortSignal) =>
    request<ProductsResponse>(
      `/products${buildQuery({
        search: filters.search,
        status: filters.status,
        categoryId: filters.categoryId,
        favorite: filters.favorite,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize
      })}`,
      { signal }
    ),
  product: (id: string, signal?: AbortSignal) =>
    request<ProductDetailResponse>(`/products/${id}`, { signal }),
  createProduct: (input: ProductInput) =>
    request<{ product: Product }>("/products", { method: "POST", body: input }),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    request<{ product: Product }>(`/products/${id}`, { method: "PATCH", body: input }),
  deleteProduct: (id: string) => request<{ deleted: boolean }>(`/products/${id}`, { method: "DELETE" }),
  bulkProducts: (body: { action: "delete"; ids: string[] } | { action: "status"; ids: string[]; status: ProductStatus }) =>
    request<{ deleted?: number; updated?: number }>("/products/bulk", { method: "POST", body }),
  checkDuplicate: (url: string) =>
    request<{ duplicate: { id: string; name: string; createdAt: string } | null }>(
      `/products/check-url${buildQuery({ url })}`
    ),

  categories: (signal?: AbortSignal) => request<{ categories: Category[] }>("/categories", { signal }),
  createCategory: (body: { name: string; color: string; icon: string }) =>
    request<{ category: Category }>("/categories", { method: "POST", body }),
  updateCategory: (id: string, body: { name?: string; color?: string; icon?: string }) =>
    request<{ category: Category }>(`/categories/${id}`, { method: "PATCH", body }),
  deleteCategory: (id: string) => request<{ deleted: boolean }>(`/categories/${id}`, { method: "DELETE" }),
  tags: (signal?: AbortSignal) => request<{ tags: Tag[] }>("/tags", { signal }),

  extract: (url: string, signal?: AbortSignal) =>
    request<ExtractionResult>("/extract", { method: "POST", body: { url }, signal }),

  settings: (signal?: AbortSignal) => request<SettingsResponse>("/settings", { signal }),
  updateSettings: (body: Partial<Pick<Settings, "currency" | "defaultProductView">>) =>
    request<{ settings: Settings }>("/settings", { method: "PATCH", body }),
  restoreBackup: (file: File) => {
    const formData = new FormData();
    formData.append("backup", file);
    return request<{ restored: boolean; images: number; safetyBackup: string }>("/settings/restore", {
      method: "POST",
      body: formData
    });
  },
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return request<{ imagePath: string; mimeType: string }>("/uploads/image", {
      method: "POST",
      body: formData
    });
  },

  authMe: () => request<{ user: any }>("/auth/me"),
  authLogin: (body: { username: string; password: string }) => request<{ user: any }>("/auth/login", { method: "POST", body }),
  authLogout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  authChangePassword: (body: { currentPassword: string; newPassword: string }) => request<{ ok: boolean }>("/auth/change-password", { method: "POST", body }),
  createInvitation: (expiresInHours = 168) => request<{ invitation: { id: string; expiresAt: string; link: string } }>("/auth/invitations", { method: "POST", body: { expiresInHours } }),
  acceptInvite: (body: { token: string; username: string; email: string; password: string }) => request<{ user: any }>("/auth/invite/accept", { method: "POST", body })
};

export async function downloadBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/settings/backup");
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const error = (payload as { error?: { message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.message ?? "The backup could not be created.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    `gift-vault-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  return { blob, filename };
}

export async function downloadNamedBackup(filename: string): Promise<Blob> {
  const response = await fetch(`/api/settings/backups/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new ApiError(response.status, "The backup file could not be downloaded.");
  return response.blob();
}

export type { Pagination };
