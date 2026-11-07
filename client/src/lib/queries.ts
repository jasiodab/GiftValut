import { useQuery } from "@tanstack/react-query";
import { api, type ProductFilters } from "./api";

export const queryKeys = {
  meta: ["meta"] as const,
  dashboard: ["dashboard"] as const,
  products: (filters: ProductFilters) => ["products", filters] as const,
  allProducts: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  settings: ["settings"] as const
};

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: ({ signal }) => api.meta(signal),
    staleTime: 15_000
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api.dashboard(signal)
  });
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: ({ signal }) => api.products(filters, signal),
    placeholderData: (previous) => previous
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ""),
    queryFn: ({ signal }) => api.product(id as string, signal),
    enabled: Boolean(id)
  });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: ({ signal }) => api.categories(signal) });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: ({ signal }) => api.tags(signal) });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: ({ signal }) => api.settings(signal) });
}
