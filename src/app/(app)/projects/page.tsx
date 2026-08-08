import Link from "next/link";
import { Funnel, Grid2X2, List, Pencil, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ArchiveProjectButton } from "@/components/forms/archive-project-button";
import { formatMoney } from "@/lib/utils";

type Price = {
  net_price: number;
  vat_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
};

type Specialist = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type ProjectService = {
  service_id: string;
  status: string;
  services: { name: string } | null;
  project_service_prices: Price[];
  project_service_members: {
    profile_id: string;
    profiles: Specialist | null;
  }[];
};

type Project = {
  id: string;
  name: string;
  status: string;
  billing_preference: "invoiced" | "uninvoiced";
  is_white_label: boolean;
  clients: { company_name: string } | null;
  project_services: ProjectService[];
};

type SearchParams = {
  service?: string;
  specialist?: string;
  view?: string;
};

export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id,name,status,billing_preference,is_white_label,clients(company_name),project_services(service_id,status,services(name),project_service_prices(net_price,vat_rate,currency,effective_from,effective_to),project_service_members(profile_id,profiles(id,first_name,last_name,email)))",
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const projects = (data || []) as unknown as Project[];
  const services = uniqueServices(projects);
  const specialists = uniqueSpecialists(projects);
  const filteredProjects = projects.filter((project) => {
    const service = activeService(project);
    const serviceMatches =
      !filters.service || service?.service_id === filters.service;
    const specialistMatches =
      !filters.specialist ||
      service?.project_service_members.some(
        (member) => member.profile_id === filters.specialist,
      );
    return serviceMatches && specialistMatches;
  });
  const listView = filters.view === "list";

  return (
    <>
      <PageHeader
        title="Projeler"
        description="Domain ve hizmet bazlı müşteri operasyonları."
        action={{ label: "Yeni proje", href: "/projects/new" }}
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <form
            method="get"
            className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input
              type="hidden"
              name="view"
              value={listView ? "list" : "grid"}
            />
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Funnel size={13} /> Hizmete göre filtrele
              </span>
              <select
                name="service"
                defaultValue={filters.service || ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#CD0B16] focus:ring-2 focus:ring-red-100"
              >
                <option value="">Tüm hizmetler</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                Sorumlu uzmana göre filtrele
              </span>
              <select
                name="specialist"
                defaultValue={filters.specialist || ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#CD0B16] focus:ring-2 focus:ring-red-100"
              >
                <option value="">Tüm uzmanlar</option>
                {specialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialistName(specialist)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white transition hover:bg-[#A90912]"
            >
              Filtrele
            </button>
            {(filters.service || filters.specialist) && (
              <Link
                href={`/projects?view=${listView ? "list" : "grid"}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                <RotateCcw size={14} /> Temizle
              </Link>
            )}
          </form>

          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <span className="text-xs font-medium text-slate-500">
              {filteredProjects.length} proje gösteriliyor
            </span>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Link
                href={viewHref(filters, "grid")}
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
                href={viewHref(filters, "list")}
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
        </div>
      </Card>

      {filteredProjects.length ? (
        listView ? (
          <ProjectTable projects={filteredProjects} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )
      ) : (
        <Card className="p-12 text-center text-sm text-slate-500">
          Seçilen filtrelerle eşleşen proje bulunamadı.
        </Card>
      )}
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const service = activeService(project);
  const price = currentPrice(service);
  const specialist = service?.project_service_members[0]?.profiles;
  const amount = displayAmount(project, price);
  return (
    <Card className="group relative p-5 transition hover:border-red-300 hover:shadow-md">
      <Link
        href={`/projects/${project.id}`}
        aria-label={`${project.name} proje detayını aç`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CD0B16] focus-visible:ring-offset-2"
      />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold transition group-hover:text-[#CD0B16]">
          {project.name}
        </h2>
        <div className="pointer-events-none flex flex-wrap items-center justify-end gap-1.5">
          {service?.services?.name && (
            <ServiceBadge name={service.services.name} />
          )}
          {project.is_white_label && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              White-label
            </span>
          )}
          <ProjectActions projectId={project.id} />
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        {project.clients?.company_name}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Info
          label="Sorumlu uzman"
          value={specialist ? specialistName(specialist) : "Atanmamış"}
        />
        <div className="sm:text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Proje bedeli
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900">
            {price && amount !== null
              ? formatMoney(amount, price.currency)
              : "Fiyat girilmedi"}
          </div>
          <BillingNote project={project} price={price} />
        </div>
      </div>
    </Card>
  );
}

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {[
                "Proje",
                "Müşteri",
                "Hizmet",
                "Sorumlu uzman",
                "Proje bedeli",
                "İşlemler",
              ].map((label) => (
                <th key={label} className="px-5 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              const service = activeService(project);
              const price = currentPrice(service);
              const specialist = service?.project_service_members[0]?.profiles;
              const amount = displayAmount(project, price);
              return (
                <tr key={project.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-semibold hover:text-[#CD0B16]"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {project.clients?.company_name || "—"}
                  </td>
                  <td className="px-5 py-4">
                    {service?.services?.name ? (
                      <ServiceBadge name={service.services.name} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {specialist ? specialistName(specialist) : "Atanmamış"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900">
                      {price && amount !== null
                        ? formatMoney(amount, price.currency)
                        : "—"}
                    </div>
                    <BillingNote project={project} price={price} />
                  </td>
                  <td className="px-5 py-4">
                    <ProjectActions projectId={project.id} />
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

function ProjectActions({ projectId }: { projectId: string }) {
  return (
    <div className="pointer-events-auto relative z-10 flex gap-1.5">
      <Link
        href={`/projects/${projectId}/edit`}
        title="Projeyi düzenle"
        aria-label="Projeyi düzenle"
        className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-[#CD0B16]"
      >
        <Pencil size={14} />
      </Link>
      <ArchiveProjectButton id={projectId} compact />
    </div>
  );
}

function ServiceBadge({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#CD0B16]">
      {name}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function BillingNote({
  project,
  price,
}: {
  project: Project;
  price: Price | undefined;
}) {
  if (!price) return null;
  return (
    <div className="mt-0.5 text-[10px] text-slate-400">
      {project.billing_preference === "invoiced"
        ? `Faturalı · KDV %${price.vat_rate} dahil`
        : "Faturasız · KDV uygulanmaz"}
    </div>
  );
}

function activeService(project: Project) {
  return (
    project.project_services.find((item) => item.status === "active") ||
    project.project_services[0]
  );
}

function currentPrice(service: ProjectService | undefined) {
  const prices = [...(service?.project_service_prices || [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  return prices.find((item) => !item.effective_to) || prices[0];
}

function displayAmount(project: Project, price: Price | undefined) {
  if (!price) return null;
  return (
    Number(price.net_price) *
    (project.billing_preference === "invoiced"
      ? 1 + Number(price.vat_rate) / 100
      : 1)
  );
}

function specialistName(specialist: Specialist) {
  return (
    `${specialist.first_name || ""} ${specialist.last_name || ""}`.trim() ||
    specialist.email
  );
}

function uniqueServices(projects: Project[]) {
  const values = new Map<string, string>();
  for (const project of projects) {
    const service = activeService(project);
    if (service?.service_id && service.services?.name)
      values.set(service.service_id, service.services.name);
  }
  return [...values.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function uniqueSpecialists(projects: Project[]) {
  const values = new Map<string, Specialist>();
  for (const project of projects) {
    for (const member of activeService(project)?.project_service_members ||
      []) {
      if (member.profiles) values.set(member.profile_id, member.profiles);
    }
  }
  return [...values.values()].sort((a, b) =>
    specialistName(a).localeCompare(specialistName(b), "tr"),
  );
}

function viewHref(filters: SearchParams, view: "grid" | "list") {
  const params = new URLSearchParams();
  if (filters.service) params.set("service", filters.service);
  if (filters.specialist) params.set("specialist", filters.specialist);
  params.set("view", view);
  return `/projects?${params.toString()}`;
}
