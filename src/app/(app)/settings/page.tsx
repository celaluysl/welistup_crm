import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RolePermissionMatrix } from "@/components/forms/role-permission-matrix";
import { CreateRoleForm } from "@/components/forms/create-role-form";
import { FeatureSettingsForm } from "@/components/forms/feature-settings-form";

export default async function Settings() {
  const s = await createClient();
  const [
    { data: roles },
    { data: permissions },
    { data: assignments },
    { data: financialReportsFeature },
  ] = await Promise.all([
    s.from("roles").select("id,name,slug").order("name"),
    s.from("permissions").select("id,key,name,module").order("module").order("key"),
    s.from("role_permissions").select("role_id,permission_id"),
    s.from("app_features").select("enabled").eq("feature_key", "financial_reports_menu").maybeSingle(),
  ]);

  return (
    <>
      <PageHeader title="Ayarlar" description="Menü özelliklerini, rolleri ve yetkileri yönetin." />
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold">Menü özellikleri</h2>
        <FeatureSettingsForm financialReportsEnabled={Boolean(financialReportsFeature?.enabled)} />
      </Card>
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold">Yeni rol</h2>
        <CreateRoleForm />
      </Card>
      <Card className="overflow-hidden">
        <RolePermissionMatrix roles={roles || []} permissions={permissions || []} assignments={assignments || []} />
      </Card>
      <p className="mt-4 text-xs text-slate-500">
        Değişiklikler anında RLS politikalarına yansır. Kullanıcıların yeniden giriş yapması gerekmez.
      </p>
    </>
  );
}
