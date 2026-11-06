import {
  Check,
  Heart,
  ShoppingBag,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import type { ProductStatus } from "./types";

export const STATUS_META: Record<
  ProductStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: LucideIcon;
    className: string;
    dotClassName: string;
    accent: string;
  }
> = {
  TO_CONSIDER: {
    label: "To consider",
    shortLabel: "Considering",
    description: "Ideas worth keeping an eye on",
    icon: Sparkles,
    className: "bg-muted text-secondary-foreground border-border",
    dotClassName: "bg-muted-foreground",
    accent: "hsl(var(--muted-foreground))"
  },
  FAVORITE: {
    label: "Favorite",
    shortLabel: "Favorite",
    description: "Your most-loved finds",
    icon: Heart,
    className: "bg-primary-soft text-primary-deep border-primary-soft",
    dotClassName: "bg-primary",
    accent: "hsl(var(--primary))"
  },
  TO_BUY: {
    label: "To buy",
    shortLabel: "To buy",
    description: "Planned purchases",
    icon: ShoppingBag,
    className: "bg-warning/10 text-warning border-warning/20",
    dotClassName: "bg-warning",
    accent: "hsl(var(--warning))"
  },
  PURCHASED: {
    label: "Purchased",
    shortLabel: "Purchased",
    description: "Gifts already secured",
    icon: Check,
    className: "bg-success/10 text-success border-success/20",
    dotClassName: "bg-success",
    accent: "hsl(var(--success))"
  }
};

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as ProductStatus[]).map((value) => ({
  value,
  label: STATUS_META[value].label
}));

export const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF", "CZK", "SEK", "NOK", "DKK", "HUF", "UAH"];

export const SORT_OPTIONS = [
  { value: "recent", label: "Recently added" },
  { value: "updated", label: "Recently updated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" }
];

export const CATEGORY_COLORS = [
  "#C9A46A",
  "#D9A3B0",
  "#B7A5C9",
  "#8FAFC4",
  "#9DB8A4",
  "#C4A484",
  "#B4B8A5",
  "#E0A5A5",
  "#88B7B0",
  "#D6A878",
  "#A8A29E"
];

export const CATEGORY_ICONS = [
  "Tag",
  "Gem",
  "Sparkles",
  "Shirt",
  "Headphones",
  "Gamepad2",
  "BookOpen",
  "Lamp",
  "Flower2",
  "Ticket",
  "CakeSlice",
  "Gift"
];
