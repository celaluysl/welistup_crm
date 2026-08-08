import { createClient } from "@/lib/supabase/server";
import { PartnerOwnershipForm } from "@/components/forms/partner-ownership-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
export default async function Partners() {
  const s = await createClient();
  const [{ data: rows }, { data: profiles }] = await Promise.all([
    s
      .from("partner_ownerships")
      .select("*,profiles(first_name,last_name)")
      .order("effective_from", { ascending: false }),
    s
      .from("profiles")
      .select("id,first_name,last_name")
      .eq("status", "active")
      .eq("employment_type", "partner"),
  ]);
  const people = (profiles || []).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
  }));
  return (
    <>
      <PageHeader
        title="Ortaklar"
        description="Ortak maaşından bağımsız, tarihsel ve yapılandırılabilir ortaklık oranları."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="divide-y">
            {rows?.map((r) => (
              <div key={r.id} className="flex justify-between px-5 py-4">
                <div>
                  <b>{person(r.profiles)}</b>
                  <div className="text-sm text-slate-500">
                    {r.effective_from} → {r.effective_to || "Devam ediyor"}
                  </div>
                </div>
                <div className="text-lg font-bold">%{r.ownership_percent}</div>
              </div>
            ))}
            {!rows?.length && (
              <div className="p-10 text-center text-sm text-slate-400">
                Henüz ortaklık oranı tanımlanmadı.
              </div>
            )}
          </div>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="mb-5 font-semibold">Ortaklık dönemi ekle</h2>
          <PartnerOwnershipForm profiles={people} />
        </Card>
      </div>
    </>
  );
}
function person(v: unknown) {
  const p = (Array.isArray(v) ? v[0] : v) as {
    first_name?: string;
    last_name?: string;
  } | null;
  return `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
}
