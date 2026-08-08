import { cn } from "@/lib/utils";

export function Field({ label, error, children, className }: React.PropsWithChildren<{ label: string; error?: string; className?: string }>) {
  return <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", className)}><span>{label}</span>{children}{error && <span className="text-xs text-red-600">{error}</span>}</label>;
}
export const inputClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:border-[#CD0B16] focus:ring-2 focus:ring-red-100";
