"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteOffer, deleteProforma } from "@/lib/actions/offers";

export function DocumentRowActions({ id, type }: { id: string; type: "offer" | "proforma" }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const editHref = type === "offer" ? `/offers/${id}/revise` : `/proformas/${id}/edit`;
  return <div className="flex items-center justify-end gap-1">
    <Link href={editHref} aria-label={type === "offer" ? "Teklifi düzenle" : "Proformayı düzenle"} title="Düzenle" className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-[#CD0B16]"><Pencil size={15} /></Link>
    <button type="button" disabled={pending} aria-label={type === "offer" ? "Teklifi sil" : "Proformayı sil"} title="Sil" onClick={() => {
      const label = type === "offer" ? "teklif" : "proforma";
      if (!confirm(`Bu ${label} kalıcı olarak silinsin mi?`)) return;
      start(async () => {
        const result = type === "offer" ? await deleteOffer(id) : await deleteProforma(id);
        if (result?.error) alert(result.error);
        else router.refresh();
      });
    }} className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-[#CD0B16] hover:bg-[#CD0B16] hover:text-white disabled:opacity-50"><Trash2 size={15} /></button>
  </div>;
}
