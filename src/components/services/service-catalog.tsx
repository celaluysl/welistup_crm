"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteService } from "@/lib/actions/core";
import { EditServiceForm } from "@/components/forms/edit-service-form";
import { Card } from "@/components/ui/card";

type Service = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  default_periodicity: "monthly" | "one_time" | "periodic";
  status: "active" | "inactive";
};

const periods = {
  monthly: "Aylık",
  one_time: "Tek seferlik",
  periodic: "Dönemsel",
};

export function ServiceCatalog({ services }: { services: Service[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const closeEditing = useCallback(() => setEditing(null), []);

  useEffect(() => {
    if (!editing && !deleting) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditing(null);
        setDeleting(null);
      }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", escape);
    };
  }, [deleting, editing]);

  function remove() {
    if (!deleting) return;
    setMessage("");
    startTransition(async () => {
      const result = await deleteService(deleting.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <Card
            key={service.id}
            className="group relative min-h-36 p-5 transition hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-900">
                  {service.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {service.category || "Kategorisiz"} · {periods[service.default_periodicity]}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(service)}
                  title="Hizmeti düzenle"
                  aria-label={`${service.name} hizmetini düzenle`}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-[#CD0B16]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setDeleting(service);
                  }}
                  title="Hizmeti sil"
                  aria-label={`${service.name} hizmetini sil`}
                  className="inline-flex size-8 items-center justify-center rounded-md bg-[#CD0B16] text-white transition hover:bg-[#A90912]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="mt-5 line-clamp-2 text-sm leading-6 text-slate-500">
              {service.description || "Bu hizmet için henüz açıklama eklenmemiş."}
            </p>
            <div className="mt-4">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${service.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {service.status === "active" ? "Aktif" : "Pasif"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal title="Hizmeti düzenle" subtitle={editing.name} onClose={closeEditing}>
          <EditServiceForm
            key={editing.id}
            service={editing}
            onSuccess={() => {
              closeEditing();
              router.refresh();
            }}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Hizmeti sil"
          subtitle="Bu işlem yalnızca kullanımda olmayan hizmetlerde yapılabilir."
          onClose={() => setDeleting(null)}
          compact
        >
          <div className="rounded-xl bg-red-50 p-4 text-sm text-slate-700">
            <strong>{deleting.name}</strong> hizmetini kalıcı olarak silmek istiyor musunuz?
          </div>
          {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Vazgeç
            </button>
            <button type="button" disabled={pending} onClick={remove} className="rounded-lg bg-[#CD0B16] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A90912] disabled:opacity-60">
              {pending ? "Siliniyor…" : "Hizmeti sil"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, subtitle, onClose, compact = false, children }: { title: string; subtitle: string; onClose: () => void; compact?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="service-dialog-title" className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl ${compact ? "max-w-lg" : "max-w-2xl"}`}>
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 id="service-dialog-title" className="text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}
