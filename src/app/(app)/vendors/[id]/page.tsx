import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  VendorAssignmentsWorkspace,
  type VendorAssignmentRow,
} from "@/components/vendors/vendor-assignments-workspace";
import {
  VendorYearWorkspace,
  type VendorPeriodRow,
} from "@/components/vendors/vendor-year-workspace";

export default async function VendorDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(query.year || currentYear);
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2200
      ? parsedYear
      : currentYear;
  const s = await createClient();
  const [{ data: vendor }, { data: projectServices }, { data: accruals }] =
    await Promise.all([
      s
        .from("vendors")
        .select(
          "*,vendor_assignments(id,project_service_id,start_date,end_date,default_amount,currency,status,payment_model,billing_preference,vat_rate,payment_day,notes,project_services(id,projects(name,clients(company_name)),services(name)))",
        )
        .eq("id", id)
        .single(),
      s
        .from("project_services")
        .select(
          "id,currency,projects(name,clients(company_name)),services(name)",
        )
        .eq("status", "active"),
      s
        .from("vendor_accruals")
        .select(
          "id,vendor_assignment_id,month,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,status,notes,projects(name,clients(company_name)),project_services(services(name)),vendor_payments(id,amount,payment_date,notes,accounts(name))",
        )
        .eq("vendor_id", id)
        .eq("year", year)
        .order("month"),
    ]);
  if (!vendor) notFound();
  const services = (projectServices || []).map((item) => ({
    id: item.id,
    currency: item.currency,
    label: `${projectLabel(item.projects)} · ${rel(item.services)?.name}`,
  }));
  const assignments = (vendor.vendor_assignments || []).map(
    (assignment: Record<string, unknown>) => {
      const service = rel(assignment.project_services) as {
        projects?: unknown;
        services?: unknown;
      } | null;
      return {
        ...assignment,
        project_label: projectLabel(service?.projects),
        service_name: rel(service?.services)?.name || "Hizmet",
      };
    },
  ) as VendorAssignmentRow[];
  const periods: VendorPeriodRow[] = (accruals || []).map((accrual) => {
    const project = rel(accrual.projects) as {
      name?: string;
      clients?: unknown;
    } | null;
    const projectService = rel(accrual.project_services) as {
      services?: unknown;
    } | null;
    const payments = (accrual.vendor_payments || []).map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.payment_date,
      accountName: rel(payment.accounts)?.name || null,
      notes: payment.notes,
    }));
    return {
      id: accrual.id,
      assignmentId: accrual.vendor_assignment_id || accrual.id,
      month: accrual.month,
      project: project?.name || "Proje",
      client: rel(project?.clients)?.company_name || "—",
      service: rel(projectService?.services)?.name || "Hizmet",
      billing: accrual.billing_preference,
      net: Number(accrual.net_amount),
      vatRate: Number(accrual.vat_rate),
      vat: Number(accrual.vat_amount),
      total: Number(accrual.amount),
      paid: payments.reduce((sum, payment) => sum + payment.amount, 0),
      currency: accrual.currency,
      dueDate: accrual.due_date,
      status: accrual.status,
      notes: accrual.notes,
      payments,
    };
  });
  return (
    <>
      <div className="mb-6">
        <div className="text-sm text-slate-500">Tedarikçiler</div>
        <h1 className="mt-1 text-2xl font-bold">{vendor.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {vendor.email || "—"} · {vendor.phone || "—"}
        </p>
      </div>
      <VendorAssignmentsWorkspace
        vendorId={id}
        assignments={assignments}
        services={services}
      />
      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Yıllık hakediş ve ödeme takibi</h2>
          <p className="mt-1 text-sm text-slate-500">
            Proje bazındaki hakedişleri ve yapılan ödemeleri ay ay inceleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/vendors/${id}?year=${year - 1}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            ← {year - 1}
          </Link>
          <div className="rounded-lg border border-red-100 bg-red-50 px-5 py-2 font-bold text-[#CD0B16]">
            {year}
          </div>
          <Link
            href={`/vendors/${id}?year=${year + 1}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {year + 1} →
          </Link>
        </div>
      </div>
      <VendorYearWorkspace rows={periods} year={year} />
    </>
  );
}

function projectLabel(value: unknown) {
  const project = rel(value) as { name?: string; clients?: unknown } | null;
  const client = rel(project?.clients);
  return (
    [client?.company_name, project?.name].filter(Boolean).join(" · ") || "Proje"
  );
}

function rel(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    company_name?: string;
    name?: string;
  } | null;
}
