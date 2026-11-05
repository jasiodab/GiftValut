import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md px-8 py-12 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-primary">Page not found</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em]">This page is not in the vault.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The link may be outdated, or the page may have moved. Your saved products are still safe.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link to="/products">Browse products</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
