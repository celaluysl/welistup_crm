"use client";

import { useActionState, useMemo, useState } from "react";
import { KeyRound, Mail, Pencil, Phone, Plus, X } from "lucide-react";
import { resetTeamMemberPassword } from "@/lib/actions/team";
import { ProfileAccessForm } from "@/components/forms/profile-access-form";
import { TeamMemberForm } from "@/components/forms/team-member-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";

type Role = { id: string; name: string };
export type TeamProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role_id: string | null;
  employment_type: string;
  status: string;
  base_salary: number;
  salary_currency: string;
};

const employmentLabels: Record<string, string> = {
  partner: "Ortak",
  employee: "Bordrolu çalışan",
  freelancer: "Freelancer",
  outsourced: "Dış kaynak",
  other: "Diğer",
};

export function TeamWorkspace({ profiles, roles, canManage }: { profiles: TeamProfile[]; roles: Role[]; canManage: boolean }) {
  const [dialog, setDialog] = useState<{ type: "create" } | { type: "edit"; profile: TeamProfile } | null>(null);
  const roleNames = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

  return (
    <>
      {canManage && <div className="mb-5 flex justify-end"><Button onClick={() => setDialog({ type: "create" })}><Plus size={16} /> Yeni ekip arkadaşı</Button></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => {
          const name = `${profile.first_name} ${profile.last_name}`.trim() || "İsimsiz kullanıcı";
          const active = profile.status === "active";
          return (
            <Card key={profile.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold text-[#CD0B16]">{initials(name)}</div>
                  <div className="min-w-0"><h2 className="truncate font-bold text-slate-900">{name}</h2><div className="mt-1 flex flex-wrap gap-1.5"><Badge>{roleNames.get(profile.role_id || "") || "Rol atanmadı"}</Badge><Badge>{employmentLabels[profile.employment_type] || profile.employment_type}</Badge></div></div>
                </div>
                {canManage && <button type="button" onClick={() => setDialog({ type: "edit", profile })} aria-label={`${name} kullanıcısını düzenle`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-[#CD0B16]"><Pencil size={16} /></button>}
              </div>
              <div className="mt-5 space-y-2 border-t pt-4 text-sm text-slate-500"><div className="flex items-center gap-2"><Mail size={15} /> <span className="truncate">{profile.email}</span></div>{profile.phone && <div className="flex items-center gap-2"><Phone size={15} /> {profile.phone}</div>}</div>
              <div className="mt-4 flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{active ? "Aktif" : profile.status === "inactive" ? "Pasif" : "Arşiv"}</span>{profile.base_salary > 0 && <span className="text-sm font-semibold text-slate-700">{money(profile.base_salary, profile.salary_currency)}</span>}</div>
            </Card>
          );
        })}
      </div>
      {!profiles.length && <Card className="p-12 text-center text-sm text-slate-500">Henüz kullanıcı bulunmuyor.</Card>}
      {dialog?.type === "create" && <Modal title="Yeni ekip arkadaşı" description="Kullanıcı hesabını ve ilk erişim bilgilerini oluşturun." onClose={() => setDialog(null)}><TeamMemberForm roles={roles} onSuccess={() => setDialog(null)} /></Modal>}
      {dialog?.type === "edit" && <MemberDialog profile={dialog.profile} roles={roles} onClose={() => setDialog(null)} />}
    </>
  );
}

function MemberDialog({ profile, roles, onClose }: { profile: TeamProfile; roles: Role[]; onClose: () => void }) {
  const name = `${profile.first_name} ${profile.last_name}`.trim();
  return <Modal title={name} description="Profil, erişim ve parola işlemlerini yönetin." onClose={onClose}>
    <ProfileAccessForm profileId={profile.id} firstName={profile.first_name} lastName={profile.last_name} email={profile.email} phone={profile.phone} roleId={profile.role_id} employmentType={profile.employment_type} status={profile.status} baseSalary={profile.base_salary} salaryCurrency={profile.salary_currency} roles={roles} onSuccess={onClose} />
    <PasswordResetForm profileId={profile.id} />
  </Modal>;
}

function PasswordResetForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(resetTeamMemberPassword, null);
  return <form action={action} className="mt-6 border-t pt-5"><div className="mb-4 flex items-center gap-2"><KeyRound size={18} className="text-[#CD0B16]" /><div><h3 className="font-bold">Parolayı sıfırla</h3><p className="text-xs text-slate-500">Yeni parola kaydedildiği anda geçerli olur.</p></div></div><input type="hidden" name="profile_id" value={profileId} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Yeni parola"><input name="new_password" type="password" minLength={8} required autoComplete="new-password" className={inputClass} /></Field><Field label="Yeni parola tekrar"><input name="confirm_password" type="password" minLength={8} required autoComplete="new-password" className={inputClass} /></Field></div>{(state?.error || state?.success) && <p className={`mt-3 text-sm ${state.error ? "text-red-600" : "text-emerald-700"}`}>{state.error || state.success}</p>}<div className="mt-4 flex justify-end"><Button type="submit" variant="secondary" disabled={pending}><KeyRound size={15} /> {pending ? "Sıfırlanıyor…" : "Parolayı sıfırla"}</Button></div></form>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5"><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button type="button" onClick={onClose} aria-label="Kapat" className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></header><div className="p-5">{children}</div></section></div>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{children}</span>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function money(value: number, currency: string) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value); }
