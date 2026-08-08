import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ArchiveClientButton } from "@/components/forms/archive-client-button";
import { formatMoney } from "@/lib/utils";

type Price = {
  net_price: number;
  vat_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
};

type ServiceMember = {
  profiles: { first_name: string; last_name: string; email: string } | null;
};

type ProjectService = {
  status: string;
  services: { name: string } | null;
  project_service_prices: Price[];
  project_service_members: ServiceMember[];
};

type Project = {
  id: string;
  name: string;
  domain: string | null;
  start_date: string | null;
  billing_preference: "invoiced" | "uninvoiced";
  status: string;
  project_services: ProjectService[];
};

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const { data: c } = await s
    .from("clients")
    .select(
      "*,projects(id,name,domain,start_date,billing_preference,status,project_services(status,services(name),project_service_prices(net_price,vat_rate,currency,effective_from,effective_to),project_service_members(profiles(first_name,last_name,email))))",
    )
    .eq("id", id)
    .single();
  if (!c) notFound();

  const projects = (c.projects || []) as unknown as Project[];
  const activeProjects = projects.filter(
    (project) => project.status === "active",
  );
  const invoicedTotals = calculateTotals(activeProjects, "invoiced");
  const uninvoicedTotals = calculateTotals(activeProjects, "uninvoiced");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">Müşteriler / Detay</div>
          <h1 className="mt-1 text-2xl font-bold">{c.company_name}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/clients/${id}/edit`}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
          >
            Düzenle
          </Link>
          <ArchiveClientButton id={id} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <div className="text-xs text-slate-500">Aktif proje</div>
          <div className="mt-2 text-2xl font-bold">{activeProjects.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500">Faturalı projeler</div>
          <MoneyTotals totals={invoicedTotals} />
          <div className="mt-1 text-[11px] text-slate-400">
            KDV dahil toplam
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500">Faturasız projeler</div>
          <MoneyTotals totals={uninvoicedTotals} />
          <div className="mt-1 text-[11px] text-slate-400">KDV uygulanmaz</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500">Müşteri tipi</div>
          <div className="mt-2 font-semibold">{c.client_type}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500">Yetkili</div>
          <div className="mt-2 font-semibold">{c.contact_name || "—"}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Genel bilgiler</h2>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">E-posta</dt>
              <dd className="mt-1">{c.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefon</dt>
              <dd className="mt-1">{c.phone || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Fatura bilgileri</h2>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Şirket Ünvanı</dt>
              <dd className="mt-1 font-medium">
                {c.legal_name || c.company_name}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Vergi Dairesi</dt>
              <dd className="mt-1">{c.tax_office || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Vergi Numarası</dt>
              <dd className="mt-1">{c.tax_number || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Adres</dt>
              <dd className="mt-1 whitespace-pre-wrap">{c.address || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="font-semibold">Projeler</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bu müşteriye bağlı tüm proje ve çalışma durumları.
            </p>
          </div>
          <Link
            href={`/projects/new?client_id=${id}`}
            className="inline-flex h-10 items-center rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white"
          >
            Yeni proje
          </Link>
        </div>
        {projects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Proje",
                    "Hizmet",
                    "Sorumlu uzman",
                    "Domain",
                    "Başlangıç",
                    "Proje değeri",
                    "Durum",
                  ].map((label) => (
                    <th key={label} className="px-6 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => {
                  const service = activeService(project);
                  const price = currentPrice(service);
                  const amount = displayAmount(project, price);
                  const specialist = service?.project_service_members[0];
                  return (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold hover:text-[#CD0B16]"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {service?.services?.name ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#CD0B16]">
                            {service.services.name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {specialistName(specialist)}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {project.domain || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {project.start_date || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {price ? formatMoney(amount, price.currency) : "—"}
                        </div>
                        {price && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {project.billing_preference === "invoiced"
                              ? `Faturalı · KDV %${price.vat_rate} dahil`
                              : "Faturasız · KDV uygulanmaz"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={projectStatusClass(project.status)}>
                          {projectStatusLabel(project.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            Bu müşteriye bağlı henüz proje bulunmuyor.
          </div>
        )}
      </Card>
    </>
  );
}

function activeService(project: Project) {
  return (
    project.project_services.find((service) => service.status === "active") ||
    project.project_services[0]
  );
}

function currentPrice(service: ProjectService | undefined) {
  return (
    [...(service?.project_service_prices || [])]
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
      .find((price) => !price.effective_to) ||
    [...(service?.project_service_prices || [])].sort((a, b) =>
      b.effective_from.localeCompare(a.effective_from),
    )[0]
  );
}

function displayAmount(project: Project, price: Price | undefined) {
  if (!price) return 0;
  const net = Number(price.net_price);
  return project.billing_preference === "invoiced"
    ? net * (1 + Number(price.vat_rate) / 100)
    : net;
}

function calculateTotals(
  projects: Project[],
  billingPreference: Project["billing_preference"],
) {
  const totals = new Map<string, number>();
  for (const project of projects.filter(
    (item) => item.billing_preference === billingPreference,
  )) {
    const price = currentPrice(activeService(project));
    if (!price) continue;
    totals.set(
      price.currency,
      (totals.get(price.currency) || 0) + displayAmount(project, price),
    );
  }
  return [...totals.entries()];
}

function MoneyTotals({ totals }: { totals: [string, number][] }) {
  return (
    <div className="mt-2 space-y-1">
      {totals.length ? (
        totals.map(([currency, amount]) => (
          <div key={currency} className="text-xl font-bold">
            {formatMoney(amount, currency)}
          </div>
        ))
      ) : (
        <div className="text-2xl font-bold">—</div>
      )}
    </div>
  );
}

function specialistName(member: ServiceMember | undefined) {
  if (!member?.profiles) return "—";
  return (
    `${member.profiles.first_name || ""} ${member.profiles.last_name || ""}`.trim() ||
    member.profiles.email ||
    "—"
  );
}

function projectStatusLabel(status: string) {
  return (
    {
      active: "Aktif",
      on_hold: "Beklemede",
      completed: "Tamamlandı",
      archived: "Arşiv",
    }[status] || status
  );
}

function projectStatusClass(status: string) {
  const tone =
    status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "on_hold"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return `rounded-full px-2.5 py-1 text-xs font-medium ${tone}`;
}
