"use server";

import { revalidatePath } from "next/cache";
import { createClient as createStandaloneClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string } | null;
const schema = z.object({
  first_name: z.string().trim().min(2, "Ad en az 2 karakter olmalı."),
  last_name: z.string().trim().min(2, "Soyad en az 2 karakter olmalı."),
  email: z.string().trim().email("Geçerli bir e-posta girin."),
  phone: z.string().trim().optional(),
  role_id: z.string().uuid("Rol seçin."),
  employment_type: z.enum([
    "partner",
    "employee",
    "freelancer",
    "outsourced",
    "other",
  ]),
  temporary_password: z
    .string()
    .min(8, "Geçici parola en az 8 karakter olmalı."),
});

export async function createTeamMember(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const current = await createClient();
  const { data: allowed } = await current.rpc("has_permission", {
    requested: "team.manage",
  });
  if (!allowed)
    return { error: "Yeni ekip arkadaşı eklemek için yetkiniz yok." };
  const authClient = createStandaloneClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await authClient.auth.signUp({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.temporary_password,
    options: {
      data: {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
      },
    },
  });
  if (error)
    return {
      error: error.message.includes("already")
        ? "Bu e-posta ile kayıtlı bir kullanıcı zaten var."
        : error.message,
    };
  if (!data.user) return { error: "Kullanıcı oluşturulamadı." };
  if (data.user.identities?.length === 0)
    return { error: "Bu e-posta ile kayıtlı bir kullanıcı zaten var." };
  const { error: profileError } = await current
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone || null,
      role_id: parsed.data.role_id,
      employment_type: parsed.data.employment_type,
      status: "active",
    })
    .eq("id", data.user.id);
  if (profileError)
    return {
      error: `Kullanıcı oluştu ancak rol atanamadı: ${profileError.message}`,
    };
  revalidatePath("/team");
  return {
    success:
      "Ekip arkadaşı oluşturuldu. Geçici parolayı kullanıcıyla güvenli şekilde paylaşın.",
  };
}
