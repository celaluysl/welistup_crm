import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" };
export function Button({ className, variant = "primary", ...props }: Props) {
  return <button className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50", variant === "primary" && "bg-[#CD0B16] text-white hover:bg-[#A90912]", variant === "secondary" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50", variant === "danger" && "bg-red-600 text-white hover:bg-red-700", className)} {...props} />;
}
