"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_: { error?: string } | null, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
  });
  if (error)
    return {
      error:
        error.code === "email_not_confirmed"
          ? "E-posta hesabı henüz onaylanmamış. Yöneticinizden parolayı yeniden sıfırlamasını isteyin."
          : "E-posta veya şifre hatalı.",
    };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
