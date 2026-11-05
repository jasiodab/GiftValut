import { useEffect, useState } from "react";
import { Gift, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
};

export function ProductImage({ src, alt, className, imageClassName, iconClassName }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden bg-card",
          className
        )}
        aria-label={`${alt} — no image`}
      >
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,rgba(120,104,89,0.14)_1px,transparent_0)] [background-size:16px_16px]" />
        <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/60">
            {failed ? <ImageOff className={cn("h-5 w-5", iconClassName)} /> : <Gift className={cn("h-5 w-5", iconClassName)} />}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em]">No image</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-card", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("h-full w-full object-cover transition-transform duration-500", imageClassName)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
