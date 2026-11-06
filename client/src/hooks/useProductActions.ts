import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { invalidateVaultData } from "@/lib/invalidate";
import type { Product } from "@/lib/types";

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ product }: { product: Product }) =>
      api.updateProduct(product.id, {
        status: product.status === "FAVORITE" ? "TO_CONSIDER" : "FAVORITE"
      }),
    onSuccess: async (result) => {
      toast.success(result.product.status === "FAVORITE" ? "Added to favorites" : "Removed from favorites");
      await invalidateVaultData(queryClient, result.product.id);
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: async () => {
      toast.success("Product deleted");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
