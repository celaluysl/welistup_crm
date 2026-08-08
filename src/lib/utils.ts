import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(Number(value));
}
