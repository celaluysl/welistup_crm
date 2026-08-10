import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  VendorAssignmentsWorkspace,
  type VendorAssignmentRow,
} from "@/components/vendors/vendor-assignments-workspace";

export default async function VendorDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const [{ data: vendor }, { data: projectServices }] = await Promise.all([
    s
      .from("vendors")
      .select(
        "*,vendor_assignments(id,project_service_id,start_date,end_date,default_amount,currency,status,payment_model,billing_preference,vat_rate,payment_day,notes,project_services(id,projects(name,clients(company_name)),services(name)))",
      )
      .eq("id", id)
      .single(),
    s
      .from("project_services")
      .select("id,currency,projects(name,clients(company_name)),services(name)")
      .eq("status", "active"),
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
