import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary-deep active:translate-y-px",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:translate-y-px",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_0_rgba(51,43,38,0.02)] hover:bg-secondary/60 hover:border-border",
        ghost: "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        soft: "bg-primary-soft text-primary-deep hover:bg-primary-soft/75",
        link: "text-primary-deep underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-5 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const computedClassName = cn(buttonVariants({ variant, size, className }));
    if (asChild) {
      return (
        <Slot className={computedClassName} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button className={computedClassName} ref={ref} disabled={disabled || loading} {...props}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
