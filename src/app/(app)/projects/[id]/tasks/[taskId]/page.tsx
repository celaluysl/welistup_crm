import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Checklist } from "@/components/forms/checklist-form";
import { TaskCommentForm } from "@/components/forms/task-comment-form";
const statusLabels: Record<string, string> = {
  todo: "Yapılacak",
  in_progress: "Devam Ediyor",
  waiting_client: "Müşteriden Dönüş",
  review: "Kontrol / Onay",
  completed: "Tamamlandı",
};
export default async function TaskDetail({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const s = await createClient();
  const [
    { data: task },
    { data: comments },
    { data: checklist },
    { data: activity },
  ] = await Promise.all([
    s
      .from("tasks")
      .select(
        "*,projects(name),project_services(services(name)),task_assignees(profiles(first_name,last_name,email))",
      )
      .eq("id", taskId)
      .eq("project_id", id)
      .single(),
    s
      .from("task_comments")
      .select(
        "id,body,created_at,creator:profiles!task_comments_created_by_fkey(first_name,last_name,email)",
      )
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    s
      .from("task_checklists")
      .select("id,title,is_completed,position")
      .eq("task_id", taskId)
      .order("position"),
    s
      .from("activity_logs")
      .select(
        "id,action,old_values,new_values,created_at,actor:profiles!activity_logs_actor_id_fkey(first_name,last_name,email)",
      )
      .eq("entity_type", "task")
      .eq("entity_id", taskId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!task) notFound();
  return (
    <>
      <div className="mb-6">
        <Link
          href={`/projects/${id}`}
          className="text-sm font-medium text-[#CD0B16]"
        >
          ← Proje detayına dön
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">
              {(task.projects as unknown as { name: string })?.name}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{task.title}</h1>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-[#CD0B16]">
            {statusLabels[task.status]}
          </span>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold">Görev bilgileri</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {task.description || "Açıklama eklenmemiş."}
            </p>
            <dl className="mt-6 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-400">Öncelik</dt>
                <dd className="mt-1 font-medium">{task.priority}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Başlangıç</dt>
                <dd className="mt-1 font-medium">{task.start_date || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Son tarih</dt>
                <dd className="mt-1 font-medium">{task.due_date || "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Checklist</h2>
            <Checklist projectId={id} taskId={taskId} items={checklist || []} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Yorumlar</h2>
            <TaskCommentForm projectId={id} taskId={taskId} />
            <div className="mt-6 divide-y">
              {comments?.map((comment) => (
                <div key={comment.id} className="py-4">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{formatPerson(comment.creator)}</span>
                    <span>
                      {new Date(comment.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold">Atananlar</h2>
            <div className="mt-4 space-y-2">
              {task.task_assignees?.map(
                (
                  x: {
                    profiles: {
                      first_name: string;
                      last_name: string;
                      email: string;
                    } | null;
                  },
                  i: number,
                ) => (
                  <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                    {formatPerson(x.profiles)}
                  </div>
                ),
              )}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold">Aktivite</h2>
            <div className="mt-4 space-y-4">
              {activity?.map((item) => (
                <div
                  key={item.id}
                  className="border-l-2 border-red-100 pl-3 text-xs"
                >
                  <div className="font-medium">
                    {item.action === "created"
                      ? "Görev oluşturuldu"
                      : "Görev güncellendi"}
                  </div>
                  <div className="mt-1 text-slate-400">
                    {formatPerson(item.actor)} ·{" "}
                    {new Date(item.created_at).toLocaleString("tr-TR")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
function formatPerson(value: unknown) {
  const p = value as {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  return (
    `${p?.first_name || ""} ${p?.last_name || ""}`.trim() ||
    p?.email ||
    "Kullanıcı"
  );
}
