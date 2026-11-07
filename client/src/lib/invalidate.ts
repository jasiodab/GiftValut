import type { QueryClient } from "@tanstack/react-query";

export async function invalidateVaultData(queryClient: QueryClient, productId?: string) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["meta"] }),
    queryClient.invalidateQueries({ queryKey: ["categories"] }),
    queryClient.invalidateQueries({ queryKey: ["tags"] }),
    queryClient.invalidateQueries({ queryKey: ["settings"] })
  ];
  if (productId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["product", productId] }));
  }
  await Promise.all(tasks);
}
