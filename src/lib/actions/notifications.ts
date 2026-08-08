"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function refreshNotifications() {
  const s = await createClient();
  const { error } = await s.rpc("refresh_my_notifications");
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
export async function markNotificationRead(id: string) {
  const s = await createClient();
  const { error } = await s
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}
export async function markAllNotificationsRead() {
  const s = await createClient();
  const { error } = await s
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}
