import Link from "next/link";
import { Plus } from "lucide-react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: { label: string; href: string } }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action && <Link href={action.href} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white hover:bg-[#A90912]"><Plus size={17}/>{action.label}</Link>}</div>;
}
