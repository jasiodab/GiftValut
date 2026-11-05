import { ceneoProvider } from "./ceneo.provider";
import { allegroProvider } from "./allegro.provider";
import { amazonProvider } from "./amazon.provider";
import { googleShoppingProvider } from "./google-shopping.provider";
import type { PriceProvider } from "./types";

export const providers: PriceProvider[] = [ceneoProvider, allegroProvider, amazonProvider, googleShoppingProvider];
