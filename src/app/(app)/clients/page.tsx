import Link from "next/link";
import {
  Building2,
  FolderKanban,
  Grid2X2,
  List,
  Mail,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

type Price = {
  net_price: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
};
type ProjectService = {
  status: string;
  project_service_prices: Price[] | null;
};
type Project = { status: string; project_services: ProjectService[] | null };
type Client = {
  id: string;
  company_name: string;
  short_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  projects: Project[] | null;
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const listView = view === "list";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id,company_name,short_name,contact_name,email,phone,status,created_at,projects(status,project_services(status,project_service_prices(net_price,currency,effective_from,effective_to)))",
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  const clients = (data || []) as unknown as Client[];

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Müşteri portföyünü ve ilişkileri yönetin."
        action={{ label: "Yeni müşteri", href: "/clients/new" }}
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">{clients.length} müşteri</div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <Link
            href="/clients?view=grid"
            title="Kart görünümü"
            aria-label="Kart görünümü"
            className={`inline-flex size-8 items-center justify-center rounded-md transition ${
              !listView
                ? "bg-white text-[#CD0B16] shadow-sm"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <Grid2X2 size={16} />
          </Link>
          <Link
            href="/clients?view=list"
            title="Liste görünümü"
            aria-label="Liste görünümü"
            className={`inline-flex size-8 items-center justify-center rounded-md transition ${
              listView
                ? "bg-white text-[#CD0B16] shadow-sm"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <List size={17} />
          </Link>
        </div>
      </div>

      {clients.length ? (
        listView ? (
          <ClientTable clients={clients} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )
      ) : (
        <Card className="p-12 text-center text-sm text-slate-500">
          {error
            ? "Veriler alınamadı. Migration ve yetkileri kontrol edin."
            : "Henüz müşteri eklenmemiş."}
        </Card>
      )}
    </>
  );
}

function ClientCard({ client }: { client: Client }) {
  const projects = client.projects || [];
  const activeProjectCount = projects.filter(
    (project) => project.status === "active",
  ).length;
  return (
    <Card className="group relative overflow-hidden p-4 transition hover:border-red-200 hover:shadow-md">
      <Link
        href={`/clients/${client.id}`}
        aria-label={`${client.company_name} müşteri detayını aç`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CD0B16] focus-visible:ring-offset-2"
      />
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#CD0B16] text-sm font-bold text-white shadow-sm">
          {companyInitials(client.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate font-bold text-slate-900 transition group-hover:text-[#CD0B16]">
              {client.company_name}
            </div>
            <StatusBadge status={client.status} />
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-400">
            {client.short_name || client.contact_name || "Müşteri"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
        <div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
            <FolderKanban size={11} /> Aktif proje
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800">
            {activeProjectCount}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            Toplam bütçe
          </div>
          <div className="mt-1 truncate text-sm font-bold text-slate-800">
            {formatBudgets(projects)}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-2 truncate">
          <Building2 size={13} className="shrink-0 text-slate-400" />
          {client.contact_name || "Yetkili belirtilmedi"}
        </div>
        <div className="flex items-center gap-2 truncate">
          <Phone size={13} className="shrink-0 text-slate-400" />
          {client.phone || "Telefon belirtilmedi"}
        </div>
        <div className="flex items-center gap-2 truncate">
          <Mail size={13} className="shrink-0 text-slate-400" />
          {client.email || "E-posta belirtilmedi"}
        </div>
      </div>
    </Card>
  );
}

function ClientTable({ clients }: { clients: Client[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {[
                "Müşteri",
                "Yetkili",
                "Telefon",
                "E-posta",
                "Aktif Proje",
                "Toplam Bütçe",
                "Durum",
              ].map((label) => (
                <th key={label} className="px-5 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => {
              const projects = client.projects || [];
              return (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[10px] font-bold text-[#CD0B16]">
                        {companyInitials(client.company_name)}
                      </div>
                      <div>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-slate-900 hover:text-[#CD0B16]"
                        >
                          {client.company_name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {client.short_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{client.contact_name || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {client.phone || "—"}
                  </td>
                  <td className="px-5 py-4">{client.email || "—"}</td>
                  <td className="px-5 py-4 font-semibold">
                    {
                      projects.filter((project) => project.status === "active")
                        .length
                    }
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {formatBudgets(projects)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={client.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "active" ? "Aktif" : "Pasif"}
    </span>
  );
}

function companyInitials(companyName: string) {
  const clean = companyName.replace(/^\[DEMO\]\s*/i, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] || ""}${words[1]?.[0] || words[0]?.[1] || ""}`.toLocaleUpperCase(
    "tr-TR",
  );
}

function formatBudgets(projects: Project[]) {
  const today = new Date().toISOString().slice(0, 10);
  const totals = new Map<string, number>();
  for (const project of projects) {
    if (project.status !== "active") continue;
    for (const service of project.project_services || []) {
      if (service.status !== "active") continue;
      const current = (service.project_service_prices || [])
        .filter(
          (price) =>
            price.effective_from <= today &&
            (!price.effective_to || price.effective_to >= today),
        )
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
      if (current)
        totals.set(
          current.currency,
          (totals.get(current.currency) || 0) + Number(current.net_price),
        );
    }
  }
  if (!totals.size) return "—";
  return [...totals.entries()]
    .map(([currency, total]) => formatMoney(total, currency))
    .join(" + ");
}
