import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  CalendarDays,
  ExternalLink,
  Pencil,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { ArchiveProjectButton } from "@/components/forms/archive-project-button";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";

type Price = {
  id: string;
  net_price: number;
  vat_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
};

type ServiceMember = {
  profile_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};

type ProjectService = {
  id: string;
  periodicity: string;
  billing_preference: string;
  start_date: string;
  payment_term_days: number;
  payment_interval_months: number;
  payment_timing: "advance" | "arrears";
  status: string;
  notes: string | null;
  services: { name: string } | null;
  project_service_prices: Price[];
  project_service_members: ServiceMember[];
};

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

const navClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-[#CD0B16]";

const periodicityLabels: Record<string, string> = {
  monthly: "Aylık",
  variable_monthly: "Değişken aylık",
  one_time: "Tek seferlik",
  periodic: "Dönemsel",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function personName(member: ServiceMember) {
  return (
    `${member.profiles?.first_name || ""} ${member.profiles?.last_name || ""}`.trim() ||
    member.profiles?.email ||
    "İsimsiz kullanıcı"
  );
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: tasks }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,name,domain,description,start_date,billing_preference,is_white_label,status,clients(company_name),project_services(id,periodicity,billing_preference,start_date,payment_term_days,payment_interval_months,payment_timing,status,notes,services(name),project_service_prices(id,net_price,vat_rate,currency,effective_from,effective_to),project_service_members(profile_id,profiles(first_name,last_name,email)))",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("tasks")
        .select(
          "id,title,description,status,priority,start_date,due_date,task_assignees(profiles(first_name,last_name)),task_comments(id,body,created_at,creator:profiles!task_comments_created_by_fkey(first_name,last_name,email))",
        )
        .eq("project_id", id)
        .order("created_at"),
      supabase
        .from("profiles")
        .select("id,first_name,last_name,email")
        .eq("status", "active")
        .order("first_name"),
    ]);

  if (!project) notFound();

  const client = project.clients as unknown as { company_name: string } | null;
  const projectServices = (project.project_services ||
    []) as unknown as ProjectService[];
  const service =
    projectServices.find((item) => item.status === "active") ||
    projectServices[0];
  const prices = [...(service?.project_service_prices || [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const currentPrice = prices.find((price) => !price.effective_to) || prices[0];
  const taskServiceOptions = service
    ? [{ id: service.id, name: service.services?.name || "Proje hizmeti" }]
    : [];
  const activeProfiles = (profiles || []) as Profile[];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            <Link href="/projects" className="hover:text-[#CD0B16]">
              Projeler
            </Link>{" "}
            / {client?.company_name || "Müşteri"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {project.name}
            </h1>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {project.status === "active" ? "Aktif" : project.status}
            </span>
            {project.is_white_label && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#CD0B16]">
                White-label
              </span>
            )}
          </div>
          <p className="mt-2 text-slate-500">
            {service?.services?.name || "Hizmet belirtilmedi"} projesi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${id}/edit`} className={navClass}>
            <Pencil className="mr-2" size={16} /> Düzenle
          </Link>
          <ArchiveProjectButton id={id} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Hizmet</div>
          <div className="mt-2 text-xl font-bold text-slate-950">
            {service?.services?.name || "—"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {periodicityLabels[service?.periodicity || ""] ||
              service?.periodicity ||
              "—"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Proje bedeli</div>
          <div className="mt-2 text-xl font-bold text-slate-950">
            {currentPrice
              ? formatMoney(currentPrice.net_price, currentPrice.currency)
              : "—"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            KDV %{currentPrice?.vat_rate ?? 0} hariç
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Başlangıç tarihi</div>
          <div className="mt-2 text-xl font-bold text-slate-950">
            {formatDate(service?.start_date || project.start_date)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {service?.payment_term_days || 0} gün ödeme vadesi
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Görevler</div>
          <div className="mt-2 text-xl font-bold text-slate-950">
            {(tasks || []).length}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {(tasks || []).filter((task) => task.status === "completed").length}{" "}
            tamamlandı
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-6 lg:p-8">
          <h2 className="text-lg font-bold text-slate-950">Proje detayları</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Detail label="Müşteri" value={client?.company_name} />
            <Detail label="Hizmet" value={service?.services?.name} />
            <Detail
              label="Domain"
              value={
                project.domain ? (
                  <a
                    href={
                      project.domain.startsWith("http")
                        ? project.domain
                        : `https://${project.domain}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#CD0B16] hover:underline"
                  >
                    {project.domain} <ExternalLink size={14} />
                  </a>
                ) : undefined
              }
            />
            <Detail
              label="Faturalama"
              value={
                (service?.billing_preference || project.billing_preference) ===
                "invoiced"
                  ? "Faturalı"
                  : "Faturasız"
              }
            />
            <Detail
              label="Dönem"
              value={
                periodicityLabels[service?.periodicity || ""] ||
                service?.periodicity
              }
            />
            <Detail
              label="Ödeme vadesi"
              value={`${service?.payment_term_days || 0} gün`}
            />
            <Detail
              label="Tahsilat periyodu"
              value={`${service?.payment_interval_months || 1} ayda bir · ${service?.payment_timing === "arrears" ? "dönem sonunda" : "dönem başında"}`}
            />
          </div>
          {(project.description || service?.notes) && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="text-sm font-medium text-slate-500">Açıklama</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {project.description || service?.notes}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6 lg:p-8">
          <div className="flex items-center gap-2">
            <Users size={19} className="text-[#CD0B16]" />
            <h2 className="text-lg font-bold text-slate-950">Sorumlu ekip</h2>
          </div>
          <div className="mt-5 space-y-3">
            {service?.project_service_members.map((member) => (
              <div
                key={member.profile_id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="text-sm font-semibold text-slate-800">
                  {personName(member)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Proje sorumlusu
                </div>
              </div>
            ))}
            {!service?.project_service_members.length && (
              <p className="py-5 text-sm text-slate-500">
                Bu projeye henüz sorumlu ekip üyesi atanmamış.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Proje görevleri
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Görev kartlarını sürükleyerek iş akışındaki durumlarını güncelleyin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${id}/reports`} className={navClass}>
            Raporlar
          </Link>
          <Link href={`/projects/${id}/recurring-tasks`} className={navClass}>
            <CalendarDays className="mr-2" size={16} /> Tekrarlayan görevler
          </Link>
          <Link href={`/projects/${id}/files`} className={navClass}>
            <Archive className="mr-2" size={16} /> Dosyalar
          </Link>
          <TaskCreateDialog
            projectId={id}
            services={taskServiceOptions}
            profiles={activeProfiles}
          />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-4">
        <TaskKanban
          key={(tasks || []).map((task) => task.id).join("-")}
          initialTasks={(tasks || []) as never[]}
          projectId={id}
        />
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}
