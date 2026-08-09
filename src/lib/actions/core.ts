"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const projectSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().trim().min(2),
  domain: z.string().trim().optional(),
  start_date: z.string().date(),
  specialist_id: z.string().uuid(),
  billing_preference: z.enum(["invoiced", "uninvoiced"]),
  is_white_label: z.string().optional(),
  description: z.string().optional(),
});
export async function createProject(
  _: { error?: string } | null,
  fd: FormData,
) {
  const p = projectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Proje bilgilerini kontrol edin." };
  const services = parseProjectServices(fd);
  if (!services.success) return { error: services.error };
  const s = await createClient();
  const { data, error } = await s.rpc("create_project_with_services", {
    p_client_id: p.data.client_id,
    p_name: p.data.name,
    p_domain: p.data.domain || null,
    p_start_date: p.data.start_date,
    p_specialist_id: p.data.specialist_id,
    p_billing_preference: p.data.billing_preference,
    p_is_white_label: p.data.is_white_label === "on",
    p_description: p.data.description || null,
    p_services: normalizeProjectVat(services.data, p.data.billing_preference),
  });
  if (error) return { error: projectWorkflowError(error.message) };
  revalidatePath("/projects");
  redirect(`/projects/${data}`);
}
const serviceSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().optional(),
  description: z.string().optional(),
  default_periodicity: z.enum([
    "monthly",
    "variable_monthly",
    "one_time",
    "periodic",
  ]),
});
export async function createService(
  _: { error?: string } | null,
  fd: FormData,
) {
  const p = serviceSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Hizmet bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("services")
    .insert({ ...p.data, created_by: user?.id, updated_by: user?.id });
  if (error) return { error: error.message };
  revalidatePath("/services");
  return {};
}
export async function archiveProject(id: string) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("projects")
    .update({ status: "archived", updated_by: user?.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}
export async function setServiceStatus(
  id: string,
  status: "active" | "inactive",
) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("services")
    .update({ status, updated_by: user?.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}
export async function updateProject(
  _: { error?: string } | null,
  fd: FormData,
) {
  const id = String(fd.get("id") || "");
  const p = projectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Proje bilgilerini kontrol edin." };
  const services = parseProjectServices(fd, true);
  if (!services.success) return { error: services.error };
  const s = await createClient();
  const { error } = await s.rpc("update_project_with_new_services", {
    p_project_id: id,
    p_client_id: p.data.client_id,
    p_name: p.data.name,
    p_domain: p.data.domain || null,
    p_start_date: p.data.start_date,
    p_specialist_id: p.data.specialist_id,
    p_billing_preference: p.data.billing_preference,
    p_is_white_label: p.data.is_white_label === "on",
    p_description: p.data.description || null,
    p_services: normalizeProjectVat(services.data, p.data.billing_preference),
  });
  if (error) return { error: projectWorkflowError(error.message) };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

const projectServiceSchema = z.object({
  service_id: z.string().uuid(),
  periodicity: z.enum(["monthly", "variable_monthly", "one_time", "periodic"]),
  net_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100),
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
  payment_term_days: z.coerce.number().int().min(0),
  notes: z.string().trim().optional(),
});
function parseProjectServices(
  fd: FormData,
  optional = false,
):
  | { success: true; data: z.infer<typeof projectServiceSchema>[] }
  | { success: false; error: string } {
  const ids = fd.getAll("service_id").map(String);
  if (!ids.length)
    return optional
      ? { success: true, data: [] }
      : { success: false, error: "Projeye en az bir hizmet ekleyin." };
  if (ids.length > 1)
    return {
      success: false,
      error: "Her projeye yalnızca bir hizmet ekleyebilirsiniz.",
    };
  const periodicities = fd.getAll("service_periodicity").map(String),
    prices = fd.getAll("service_net_price").map(String),
    vats = fd.getAll("service_vat_rate").map(String),
    currencies = fd.getAll("service_currency").map(String),
    terms = fd.getAll("service_payment_term_days").map(String),
    notes = fd.getAll("service_notes").map(String);
  const parsed = z.array(projectServiceSchema).safeParse(
    ids.map((service_id, i) => ({
      service_id,
      periodicity: periodicities[i],
      net_price: prices[i],
      vat_rate: vats[i],
      currency: currencies[i],
      payment_term_days: terms[i],
      notes: notes[i] || "",
    })),
  );
  if (!parsed.success)
    return {
      success: false,
      error: "Hizmet, fiyat, KDV ve vade bilgilerini kontrol edin.",
    };
  if (new Set(parsed.data.map((x) => x.service_id)).size !== parsed.data.length)
    return {
      success: false,
      error: "Aynı hizmeti projeye iki kez ekleyemezsiniz.",
    };
  return { success: true, data: parsed.data };
}
function projectWorkflowError(message: string) {
  if (message.includes("project_domain_service_exists"))
    return "Bu domain için seçtiğiniz hizmete ait aktif bir proje zaten var.";
  if (message.includes("projects_active_domain_unique"))
    return "Bu domain için aktif bir proje zaten var. Sayfayı yenileyip tekrar deneyin.";
  if (message.includes("one_service_per_project"))
    return "Her projeye yalnızca bir hizmet ekleyebilirsiniz.";
  if (message.includes("project_already_has_service"))
    return "Bu projeye zaten bir hizmet tanımlanmış.";
  if (message.includes("duplicate_service"))
    return "Aynı hizmeti projeye iki kez ekleyemezsiniz.";
  if (message.includes("service_already_exists"))
    return "Seçilen hizmetlerden biri bu projede zaten aktif.";
  return message;
}

function normalizeProjectVat(
  services: z.infer<typeof projectServiceSchema>[],
  billingPreference: "invoiced" | "uninvoiced",
) {
  return services.map((service) => ({
    ...service,
    vat_rate: billingPreference === "uninvoiced" ? 0 : service.vat_rate,
  }));
}

const profileSchema = z.object({
  profile_id: z.string().uuid(),
  role_id: z.string().uuid(),
  employment_type: z.enum([
    "partner",
    "employee",
    "freelancer",
    "outsourced",
    "other",
  ]),
  status: z.enum(["active", "inactive", "archived"]),
  base_salary: z.coerce.number().min(0),
  salary_currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
});
export async function updateProfileAccess(
  _: { error?: string; success?: string } | null,
  fd: FormData,
) {
  const p = profileSchema.safeParse(Object.fromEntries(fd));
  if (!p.success)
    return { error: "Rol ve çalışma tipi bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s
    .from("profiles")
    .update({
      role_id: p.data.role_id,
      employment_type: p.data.employment_type,
      status: p.data.status,
      base_salary: p.data.base_salary,
      salary_currency: p.data.salary_currency,
    })
    .eq("id", p.data.profile_id);
  if (error)
    return {
      error:
        error.code === "42501" ? "Bu işlem için yetkiniz yok." : error.message,
    };
  if (["partner", "employee"].includes(p.data.employment_type)) {
    const now = new Date();
    const { error: payrollError } = await s.rpc("generate_payroll_periods", {
      p_year: now.getFullYear(),
      p_month: now.getMonth() + 1,
    });
    if (payrollError) return { error: payrollError.message };
  }
  revalidatePath("/team");
  revalidatePath("/payroll");
  return { success: "Profil ve maaş bilgileri güncellendi." };
}
const serviceUpdateSchema = serviceSchema.extend({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});
export async function updateService(
  _: { error?: string; success?: string } | null,
  fd: FormData,
) {
  const p = serviceUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Hizmet bilgilerini kontrol edin." };
  const { id, ...values } = p.data;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("services")
    .update({
      ...values,
      description: values.description || null,
      category: values.category || null,
      updated_by: user?.id,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/services");
  return { success: "Hizmet güncellendi." };
}

export async function deleteService(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Hizmet kaydı geçersiz." };
  const s = await createClient();
  const { error } = await s.from("services").delete().eq("id", parsed.data);
  if (error)
    return {
      error:
        error.code === "23503"
          ? "Bu hizmet bir proje veya teklif içinde kullanıldığı için silinemez. Düzenleme ekranından pasife alabilirsiniz."
          : error.code === "42501"
            ? "Bu işlem için yetkiniz yok."
            : error.message,
    };
  revalidatePath("/services");
  return { success: "Hizmet silindi." };
}
