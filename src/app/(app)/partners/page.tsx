import {
  PartnerWorkspace,
  type PartnerOwnership,
} from "@/components/partners/partner-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function Partners() {
  const supabase = await createClient();
  const [ownershipResult, profileResult] = await Promise.all([
    supabase
      .from("partner_ownerships")
      .select("id,profile_id,ownership_percent,effective_from,effective_to")
      .order("effective_from", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,first_name,last_name")
      .eq("status", "active")
      .eq("employment_type", "partner")
      .order("first_name"),
  ]);

  const profiles = (profileResult.data || []).map((profile) => ({
    id: profile.id,
    name: `${profile.first_name} ${profile.last_name}`.trim(),
  }));
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const rows: PartnerOwnership[] = (ownershipResult.data || []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    name: profilesById.get(row.profile_id)?.name || "İsimsiz ortak",
    percent: Number(row.ownership_percent),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  }));
  const loadError = ownershipResult.error || profileResult.error;

  return (
    <>
      <PageHeader
        title="Ortaklar"
        description="Ortak maaşından bağımsız ortaklık oranlarını ve geçerlilik dönemlerini yönetin."
      />
      {loadError ? (
        <Card className="border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
          Ortaklık bilgileri yüklenemedi: {loadError.message}
        </Card>
      ) : (
        <PartnerWorkspace rows={rows} profiles={profiles} />
      )}
    </>
  );
}
