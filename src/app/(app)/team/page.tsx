import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ProfileAccessForm } from "@/components/forms/profile-access-form";
import { TeamMemberForm } from "@/components/forms/team-member-form";
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
      {canManage && (
        <Card className="mb-6 p-6">
          <details>
            <summary className="cursor-pointer list-none font-semibold text-[#CD0B16]">
              + Yeni ekip arkadaşı ekle
            </summary>
            <div className="mt-5 border-t pt-5">
              <TeamMemberForm roles={roles || []} />
            </div>
          </details>
        </Card>
      )}
      <div className="space-y-4">
        {profiles?.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(220px,1fr)_minmax(500px,2fr)] xl:items-center">
              <div>
                <div className="font-semibold">
                  {`${p.first_name} ${p.last_name}`.trim() ||
                    "İsimsiz kullanıcı"}
                </div>
                <div className="mt-1 text-sm text-slate-500">{p.email}</div>
                {p.phone && (
                  <div className="text-xs text-slate-400">{p.phone}</div>
                )}
              </div>
              <ProfileAccessForm
                profileId={p.id}
                roleId={p.role_id}
                employmentType={p.employment_type}
                status={p.status}
                baseSalary={Number(p.base_salary || 0)}
                salaryCurrency={p.salary_currency || "TRY"}
                roles={roles || []}
              />
            </div>
          </Card>
        ))}
        {!profiles?.length && (
          <Card className="p-10 text-center text-sm text-slate-500">
            {error
              ? "Ekip verileri için yetkiniz yok."
              : "Henüz kullanıcı bulunmuyor."}
          </Card>
        )}
      </div>
    </>
  );
}
