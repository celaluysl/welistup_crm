"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Funnel, Plus, RotateCcw, X } from "lucide-react";
import { moveLead } from "@/lib/actions/sales";
import { formatMoney } from "@/lib/utils";
import { LeadForm } from "@/components/forms/lead-form";
import { LeadActivityForm } from "@/components/forms/lead-activity-form";
import { ConvertLeadButton } from "@/components/forms/convert-lead-button";
import { inputClass } from "@/components/ui/field";
import { Lead, SalesKanban, salesColumns, Status } from "@/components/sales/sales-kanban";

type Service = { id: string; name: string };
type Profile = { id: string; first_name: string; last_name: string; email: string };
const activityLabels: Record<string, string> = { call: "Telefon", whatsapp: "WhatsApp", email: "E-posta", meeting: "Görüşme", note: "Not", status_change: "Durum değişikliği" };

export function SalesWorkspace({ initialLeads, services, profiles }: { initialLeads: Lead[]; services: Service[]; profiles: Profile[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!creating && !selected) return;
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setCreating(false); setSelected(null); } }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", escape); };
  }, [creating, selected]);

  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source).filter(Boolean) as string[])].sort(), [leads]);
  const filtered = useMemo(() => leads.filter((lead) => {
    const needle = query.toLocaleLowerCase("tr-TR");
    const matchesQuery = !needle || `${lead.company_name} ${lead.contact_name || ""} ${lead.email || ""}`.toLocaleLowerCase("tr-TR").includes(needle);
    return matchesQuery && (!service || lead.services.some((item) => item.id === service)) && (!owner || lead.sales_owner_id === owner) && (!source || lead.source === source);
  }), [leads, owner, query, service, source]);

  function changeStatus(id: string, status: Status) {
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead));
    setSelected((current) => current?.id === id ? { ...current, status } : current);
    startTransition(async () => { await moveLead(id, status); router.refresh(); });
  }
  const reset = () => { setQuery(""); setService(""); setOwner(""); setSource(""); };
  const created = useCallback(() => { setCreating(false); router.refresh(); }, [router]);
  const activityAdded = useCallback(() => { router.refresh(); }, [router]);

  return (
    <>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Funnel size={13} /> Lead ara</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Firma, yetkili veya e-posta" className={inputClass} /></label>
            <Filter label="Hizmet" value={service} setValue={setService}><option value="">Tüm hizmetler</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Filter>
            <Filter label="Satış sorumlusu" value={owner} setValue={setOwner}><option value="">Tüm sorumlular</option>{profiles.map((item) => <option key={item.id} value={item.id}>{person(item)}</option>)}</Filter>
            <Filter label="Kaynak" value={source} setValue={setSource}><option value="">Tüm kaynaklar</option>{sources.map((item) => <option key={item}>{item}</option>)}</Filter>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={reset} title="Filtreleri temizle" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw size={15} /> Temizle</button>
            <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white hover:bg-[#A90912]"><Plus size={16} /> Yeni lead</button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">{filtered.length} / {leads.length} lead gösteriliyor</div>
      </div>

      <div className="overflow-x-auto pb-5"><SalesKanban leads={filtered} onMove={changeStatus} onOpen={setSelected} /></div>

      {creating && <Modal title="Yeni lead oluştur" subtitle="Satış fırsatını pipeline’a ekleyin." onClose={() => setCreating(false)}><LeadForm services={services} profiles={profiles} onSuccess={created} /></Modal>}
      {selected && <LeadQuickView lead={selected} onClose={() => setSelected(null)} onStatusChange={(status) => changeStatus(selected.id, status)} onActivityAdded={activityAdded} />}
    </>
  );
}

function LeadQuickView({ lead, onClose, onStatusChange, onActivityAdded }: { lead: Lead; onClose: () => void; onStatusChange: (status: Status) => void; onActivityAdded: () => void }) {
  return (
    <Modal title={lead.company_name} subtitle={lead.contact_name || "Yetkili belirtilmedi"} onClose={onClose} wide>
      <div className="grid lg:grid-cols-[1fr_.9fr]">
        <div className="space-y-6 p-6 lg:border-r lg:border-slate-200">
          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <Info label="Telefon" value={lead.phone} /><Info label="E-posta" value={lead.email} /><Info label="Kaynak" value={lead.source} /><Info label="Sonraki iletişim" value={lead.next_contact_date} /><Info label="Tahmini bütçe" value={lead.estimated_budget !== null ? formatMoney(lead.estimated_budget, lead.currency) : null} /><Info label="Satış sorumlusu" value={lead.owner ? person(lead.owner) : null} />
          </div>
          {!!lead.services.length && <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">İlgilenilen hizmetler</div><div className="mt-2 flex flex-wrap gap-2">{lead.services.map((service) => <span key={service.id} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#CD0B16]">{service.name}</span>)}</div></div>}
          {lead.description && <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Açıklama</div><p className="mt-2 text-sm leading-6 text-slate-600">{lead.description}</p></div>}
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Satış aşaması</div><div className="mt-3 flex flex-wrap gap-2">{salesColumns.map((column) => <button key={column.id} type="button" onClick={() => onStatusChange(column.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${lead.status === column.id ? "border-[#CD0B16] bg-red-50 text-[#CD0B16]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{column.label}</button>)}</div></div>
          <div className="border-t border-slate-200 pt-5"><ConvertLeadButton leadId={lead.id} convertedClientId={lead.converted_client_id} /></div>
          <div className="border-t border-slate-200 pt-5"><h3 className="mb-4 font-bold text-slate-900">Yeni aktivite</h3><LeadActivityForm leadId={lead.id} onSuccess={onActivityAdded} /></div>
        </div>
        <div className="p-6"><h3 className="font-bold text-slate-900">Aktivite geçmişi</h3><div className="mt-5 max-h-[620px] space-y-5 overflow-y-auto pr-2">{lead.activities.map((activity) => <div key={activity.id} className="border-l-2 border-red-100 pl-4"><div className="flex justify-between gap-3"><span className="text-sm font-semibold">{activityLabels[activity.activity_type] || activity.activity_type}</span><time className="text-[10px] text-slate-400">{new Date(activity.activity_at).toLocaleString("tr-TR")}</time></div><p className="mt-2 text-sm leading-6 text-slate-600">{activity.note}</p><div className="mt-1 text-xs text-slate-400">{person(activity.creator)}</div></div>)}{!lead.activities.length && <p className="text-sm text-slate-500">Henüz aktivite bulunmuyor.</p>}</div></div>
      </div>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, wide = false, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="sales-dialog-title" className={`max-h-[94vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl ${wide ? "max-w-6xl" : "max-w-3xl"}`}><header className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5"><div><h2 id="sales-dialog-title" className="text-xl font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Kapat" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X size={20} /></button></header>{wide ? children : <div className="p-6">{children}</div>}</section></div>;
}
function Filter({ label, value, setValue, children }: { label: string; value: string; setValue: (value: string) => void; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span><select value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>{children}</select></label>; }
function Info({ label, value }: { label: string; value: string | null | undefined }) { return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-700">{value || "—"}</div></div>; }
function person(value: { first_name?: string; last_name?: string; email?: string } | null) { return `${value?.first_name || ""} ${value?.last_name || ""}`.trim() || value?.email || "Kullanıcı"; }
