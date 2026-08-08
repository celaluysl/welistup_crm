"use client";

import { CalendarDays, GripVertical, UserRound } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatMoney } from "@/lib/utils";

export type Status =
  | "new"
  | "contacted"
  | "meeting"
  | "preparing_offer"
  | "offer_sent"
  | "negotiation"
  | "won"
  | "lost";

export type LeadActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  note: string | null;
  activity_at: string;
  creator: { first_name: string; last_name: string; email: string } | null;
};

export type Lead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: Status;
  estimated_budget: number | null;
  currency: string;
  sales_owner_id: string | null;
  next_contact_date: string | null;
  description: string | null;
  converted_client_id: string | null;
  owner: { first_name: string; last_name: string; email: string } | null;
  services: { id: string; name: string }[];
  activities: LeadActivity[];
};

export const salesColumns: {
  id: Status;
  label: string;
  hint: string;
  color: string;
  dot: string;
  count: string;
}[] = [
  { id: "new", label: "Yeni Lead", hint: "Yeni fırsatlar", color: "border-slate-500", dot: "bg-slate-500", count: "bg-slate-100 text-slate-600" },
  { id: "contacted", label: "İletişime Geçildi", hint: "İlk temas yapıldı", color: "border-blue-500", dot: "bg-blue-500", count: "bg-blue-50 text-blue-600" },
  { id: "meeting", label: "Görüşme", hint: "İhtiyaç analizi", color: "border-cyan-500", dot: "bg-cyan-500", count: "bg-cyan-50 text-cyan-700" },
  { id: "preparing_offer", label: "Teklif Hazırlanıyor", hint: "Fiyatlandırma", color: "border-amber-500", dot: "bg-amber-500", count: "bg-amber-50 text-amber-700" },
  { id: "offer_sent", label: "Teklif Gönderildi", hint: "Müşteri değerlendirmesi", color: "border-orange-500", dot: "bg-orange-500", count: "bg-orange-50 text-orange-700" },
  { id: "negotiation", label: "Revize / Pazarlık", hint: "Son görüşmeler", color: "border-violet-500", dot: "bg-violet-500", count: "bg-violet-50 text-violet-700" },
  { id: "won", label: "Kazanıldı", hint: "Müşteriye dönüşecek", color: "border-emerald-500", dot: "bg-emerald-500", count: "bg-emerald-50 text-emerald-700" },
  { id: "lost", label: "Kaybedildi", hint: "Kapanan fırsatlar", color: "border-rose-500", dot: "bg-rose-500", count: "bg-rose-50 text-rose-700" },
];

export function SalesKanban({ leads, onMove, onOpen }: { leads: Lead[]; onMove: (id: string, status: Status) => void; onOpen: (lead: Lead) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  function ended(event: DragEndEvent) {
    const next = event.over?.id as Status | undefined;
    if (!next || !salesColumns.some((column) => column.id === next)) return;
    const lead = leads.find((item) => item.id === event.active.id);
    if (!lead || lead.status === next) return;
    onMove(lead.id, next);
  }
  return (
    <DndContext sensors={sensors} onDragEnd={ended}>
      <div className="grid min-w-[2320px] grid-cols-8 gap-3">
        {salesColumns.map((column) => (
          <Column key={column.id} column={column} leads={leads.filter((lead) => lead.status === column.id)} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ column, leads, onOpen }: { column: (typeof salesColumns)[number]; leads: Lead[]; onOpen: (lead: Lead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section ref={setNodeRef} className={`flex min-h-[520px] flex-col rounded-xl border border-slate-200 border-t-[3px] bg-slate-100/80 ${column.color} ${isOver ? "border-[#CD0B16] bg-red-50 ring-1 ring-red-100" : ""}`}>
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${column.dot}`} />
            <h2 className="truncate text-sm font-bold text-slate-800">{column.label}</h2>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${column.count}`}>{leads.length}</span>
        </div>
        <p className="mt-1 pl-4 text-[10px] text-slate-400">{column.hint}</p>
      </header>
      <div className="flex-1 space-y-3 p-3">
        {leads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />)}
        {!leads.length && <div className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-8 text-center text-[11px] text-slate-400">Leadleri buraya sürükleyin</div>}
      </div>
    </section>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const owner = lead.owner ? `${lead.owner.first_name || ""} ${lead.owner.last_name || ""}`.trim() || lead.owner.email : "Atanmadı";
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }} {...attributes} {...listeners} onClick={() => !isDragging && onOpen(lead)} className={`relative touch-none rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-100 hover:shadow-md ${isDragging ? "cursor-grabbing opacity-70 shadow-xl" : "cursor-grab"}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 shrink-0 text-slate-300" size={14} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900">{lead.company_name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">{lead.contact_name || "Yetkili belirtilmedi"}</p>
        </div>
      </div>
      {lead.estimated_budget !== null && <div className="mt-4 text-base font-bold text-slate-800">{formatMoney(lead.estimated_budget, lead.currency)}</div>}
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-2"><UserRound size={13} className="text-slate-400" /><span className="truncate">{owner}</span></div>
        <div className="flex items-center gap-2"><CalendarDays size={13} className={lead.next_contact_date ? "text-[#CD0B16]" : "text-slate-400"} /><span>{lead.next_contact_date || "İletişim tarihi yok"}</span></div>
      </div>
      {!!lead.services.length && <div className="mt-3 flex flex-wrap gap-1">{lead.services.slice(0, 2).map((service) => <span key={service.id} className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-[#CD0B16]">{service.name}</span>)}</div>}
    </article>
  );
}
