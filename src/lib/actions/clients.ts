"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validation/client";

export type FormState = { error?: string; fields?: Record<string,string> } | null;
export async function createClientAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData.entries()); const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formu kontrol edin." };
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("clients").insert({ ...parsed.data, created_by: user?.id, updated_by: user?.id });
  if (error) return { error: error.code === "42501" ? "Bu işlem için yetkiniz yok." : error.message };
  revalidatePath("/clients"); redirect("/clients");
}
export async function archiveClient(id: string) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("clients").update({ status: "archived", updated_by: user?.id }).eq("id", id);
  revalidatePath("/clients");
}

export async function updateClientAction(_:FormState,formData:FormData):Promise<FormState>{const id=String(formData.get("id")||"");const raw=Object.fromEntries(formData.entries());const parsed=clientSchema.safeParse(raw);if(!parsed.success)return{error:parsed.error.issues[0]?.message||"Formu kontrol edin."};const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();const{error}=await supabase.from("clients").update({...parsed.data,updated_by:user?.id}).eq("id",id);if(error)return{error:error.code==="42501"?"Bu işlem için yetkiniz yok.":error.message};revalidatePath(`/clients/${id}`);revalidatePath("/clients");redirect(`/clients/${id}`)}
