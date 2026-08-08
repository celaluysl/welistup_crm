"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export type TaskState = { error?: string; success?: string } | null;
const taskSchema = z.object({
  project_id: z.string().uuid(),
  project_service_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  title: z.string().trim().min(2),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z
    .enum(["todo", "in_progress", "waiting_client", "review", "completed"])
    .default("todo"),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
});
export async function createTask(
  _: TaskState,
  fd: FormData,
): Promise<TaskState> {
  const p = taskSchema.safeParse(Object.fromEntries(fd));
  if (!p.success)
    return {
      error: p.error.issues[0]?.message || "Görev bilgilerini kontrol edin.",
    };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: task, error } = await s
    .from("tasks")
    .insert({
      ...p.data,
      project_service_id: p.data.project_service_id || null,
      start_date: p.data.start_date || null,
      due_date: p.data.due_date || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const assignees = fd.getAll("assignees").map(String);
  if (assignees.length) {
    const { error: assignError } = await s
      .from("task_assignees")
      .insert(
        assignees.map((profile_id) => ({ task_id: task.id, profile_id })),
      );
    if (assignError)
      return {
        error:
          "Görev oluştu ancak atamalar kaydedilemedi: " + assignError.message,
      };
  }
  revalidatePath(`/projects/${p.data.project_id}`);
  revalidatePath(`/projects/${p.data.project_id}/tasks`);
  return { success: "Görev oluşturuldu." };
}
export async function moveTask(
  taskId: string,
  projectId: string,
  status: "todo" | "in_progress" | "waiting_client" | "review" | "completed",
) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("tasks")
    .update({
      status,
      updated_by: user?.id,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
}
const quickUpdateSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  title: z.string().trim().min(2),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
});
export async function quickUpdateTask(fd: FormData) {
  const p = quickUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!p.success)
    return {
      error: p.error.issues[0]?.message || "Görev bilgilerini kontrol edin.",
    };
  const d = p.data;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s
    .from("tasks")
    .update({
      title: d.title,
      description: d.description || null,
      priority: d.priority,
      start_date: d.start_date || null,
      due_date: d.due_date || null,
      updated_by: user.id,
    })
    .eq("id", d.task_id)
    .eq("project_id", d.project_id);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${d.project_id}`);
  revalidatePath(`/projects/${d.project_id}/tasks/${d.task_id}`);
  return { success: "Görev güncellendi." };
}
const commentSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});
export async function addTaskComment(
  _: TaskState,
  fd: FormData,
): Promise<TaskState> {
  const p = commentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Yorum boş olamaz." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s.from("task_comments").insert({
    task_id: p.data.task_id,
    body: p.data.body,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${p.data.project_id}/tasks/${p.data.task_id}`);
  return { success: "Yorum eklendi." };
}
const checklistSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
});
export async function addChecklistItem(
  _: TaskState,
  fd: FormData,
): Promise<TaskState> {
  const p = checklistSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Checklist maddesi boş olamaz." };
  const s = await createClient();
  const { count } = await s
    .from("task_checklists")
    .select("id", { count: "exact", head: true })
    .eq("task_id", p.data.task_id);
  const { error } = await s.from("task_checklists").insert({
    task_id: p.data.task_id,
    title: p.data.title,
    position: count || 0,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${p.data.project_id}/tasks/${p.data.task_id}`);
  return { success: "Madde eklendi." };
}
export async function toggleChecklistItem(
  itemId: string,
  projectId: string,
  taskId: string,
  completed: boolean,
) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("task_checklists")
    .update({
      is_completed: completed,
      completed_by: completed ? user?.id : null,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}
const updateSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  project_service_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  title: z.string().trim().min(2),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum([
    "todo",
    "in_progress",
    "waiting_client",
    "review",
    "completed",
  ]),
  waiting_reason: z
    .union([
      z.literal(""),
      z.enum([
        "client",
        "internal_team",
        "freelancer",
        "materials",
        "technical",
        "other",
      ]),
    ])
    .optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
});
export async function updateTask(
  _: TaskState,
  fd: FormData,
): Promise<TaskState> {
  const p = updateSchema.safeParse(Object.fromEntries(fd));
  if (!p.success)
    return {
      error: p.error.issues[0]?.message || "Görev bilgilerini kontrol edin.",
    };
  const d = p.data;
  const assignees = fd.getAll("assignees").map(String);
  const s = await createClient();
  const { error } = await s.rpc("update_task_with_assignees", {
    p_task_id: d.task_id,
    p_title: d.title,
    p_description: d.description || "",
    p_project_service_id: d.project_service_id || null,
    p_priority: d.priority,
    p_status: d.status,
    p_waiting_reason: d.waiting_reason || null,
    p_start_date: d.start_date || null,
    p_due_date: d.due_date || null,
    p_assignee_ids: assignees,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${d.project_id}/tasks`);
  revalidatePath(`/projects/${d.project_id}/tasks/${d.task_id}`);
  return { success: "Görev güncellendi." };
}
