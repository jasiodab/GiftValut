import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import("@/pages/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const ComparisonPage = lazy(() => import("@/pages/ComparisonPage").then((m) => ({ default: m.ComparisonPage })));
const BudgetPage = lazy(() => import("@/pages/BudgetPage").then((m) => ({ default: m.BudgetPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } } });

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
    try { await api.authLogin({ username: u, password: p }); onLogin(); }
    catch (e: any) { setErr(e?.message ?? "Login failed"); }
    finally { setLoading(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="text-xl font-semibold">Gift Vault</h1>
        <form onSubmit={submit} className="space-y-3">
          <Input autoComplete="username" placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} required />
          <Input autoComplete="current-password" type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} required />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "Sign in"}</Button>
        </form>
      </Card>
    </div>
  );
}

function InvitationScreen({ token }: { token: string }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      await api.acceptInvite({ token, username, email, password });
      window.location.replace("/");
    } catch (caught: any) { setError(caught?.message ?? "Invitation could not be accepted."); }
    finally { setLoading(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div><h1 className="text-xl font-semibold">Join Gift Vault</h1><p className="mt-1 text-sm text-muted-foreground">Create your private account.</p></div>
        <form onSubmit={submit} className="space-y-3">
          <Input autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
          <Input autoComplete="email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input autoComplete="new-password" type="password" placeholder="Password (at least 12 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
        </form>
      </Card>
    </div>
  );
}

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { api.authMe().then(() => setAuthed(true)).catch(() => setAuthed(false)); }, []);
  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.clear();
      setAuthed(false);
    };
    window.addEventListener("gv:unauthorized", onUnauthorized);
    return () => window.removeEventListener("gv:unauthorized", onUnauthorized);
  }, []);
  const invitationToken = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/)?.[1];
  if (invitationToken) return <InvitationScreen token={decodeURIComponent(invitationToken)} />;
  if (authed === null) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!authed) return <LoginScreen onLogin={() => { queryClient.clear(); setAuthed(true); }} />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        <BrowserRouter>
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="comparison" element={<ComparisonPage />} />
                <Route path="budget" element={<BudgetPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
