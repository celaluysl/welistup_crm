import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { TeamWorkspace } from "@/components/team/team-workspace";
export default async function Team() {
  const s = await createClient();
  const [{ data: profiles, error }, { data: roles }, { data: canManage }] =
    await Promise.all([
      s
        .from("profiles")
        .select(
          "id,first_name,last_name,email,phone,role_id,employment_type,status,base_salary,salary_currency",
        )
        .order("first_name"),
      s.from("roles").select("id,name").order("name"),
      s.rpc("has_permission", { requested: "team.manage" }),
    ]);
  return (
    <>
      <PageHeader
        title="Ekip"
        description="Kullanıcı rolleri, çalışma tipleri ve erişim durumları."
      />
      <TeamWorkspace profiles={(profiles || []).map((p) => ({ ...p, base_salary: Number(p.base_salary || 0), salary_currency: p.salary_currency || "TRY" }))} roles={roles || []} canManage={Boolean(canManage)} />
      {error && <p className="mt-4 text-sm text-red-600">Ekip verileri için yetkiniz yok.</p>}
    </>
  );
}
