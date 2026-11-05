import { useQuery } from "@tanstack/react-query";
import { api, type ProductFilters } from "./api";

export const queryKeys = {
  meta: ["meta"] as const,
  dashboard: ["dashboard"] as const,
  budget: ["budget"] as const,
  products: (filters: ProductFilters) => ["products", filters] as const,
  allProducts: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  groups: ["groups"] as const,
  settings: ["settings"] as const
};

export function useMeta() {
  return useQuery({ queryKey: queryKeys.meta, queryFn: api.meta, staleTime: 15_000 });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
}

export function useBudget() {
  return useQuery({ queryKey: queryKeys.budget, queryFn: api.budget });
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: () => api.products(filters),
    placeholderData: (previous) => previous
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ""),
    queryFn: () => api.product(id as string),
    enabled: Boolean(id)
  });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: api.categories });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: api.tags });
}

export function useGroups() {
  return useQuery({ queryKey: queryKeys.groups, queryFn: api.groups });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
}
