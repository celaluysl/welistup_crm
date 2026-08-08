import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { TaskForm } from "@/components/forms/task-form";
import { TaskKanban } from "@/components/tasks/task-kanban";
const navClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50";
export default async function ProjectTasks({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const [
    { data: project },
    { data: tasks },
    { data: services },
    { data: profiles },
  ] = await Promise.all([
    s.from("projects").select("name").eq("id", id).single(),
    s
      .from("tasks")
      .select(
        "id,title,description,status,priority,start_date,due_date,task_assignees(profiles(first_name,last_name)),task_comments(id,body,created_at,creator:profiles!task_comments_created_by_fkey(first_name,last_name,email))",
      )
      .eq("project_id", id)
      .order("created_at"),
    s
      .from("project_services")
      .select("id,services(name)")
      .eq("project_id", id)
      .eq("status", "active"),
    s
      .from("profiles")
      .select("id,first_name,last_name,email")
      .eq("status", "active")
      .order("first_name"),
  ]);
  if (!project) notFound();
  const options = (services || []).map((x) => ({
    id: x.id,
    name: (x.services as unknown as { name: string })?.name || "Hizmet",
  }));
  return (
    <>
      <PageHeader
        title={`${project.name} · Görevler`}
        description="Görevleri sürükleyerek durumlar arasında taşıyın."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/projects/${id}/reports`} className={navClass}>
          Raporlar
        </Link>
        <Link href={`/projects/${id}/recurring-tasks`} className={navClass}>
          Tekrarlayan görevler
        </Link>
        <Link href={`/projects/${id}/files`} className={navClass}>
          Dosyalar
        </Link>
      </div>
      <div className="overflow-x-auto pb-4">
        <TaskKanban initialTasks={(tasks || []) as never[]} projectId={id} />
      </div>
      <Card className="mt-6 p-6">
        <h2 className="mb-5 font-semibold">Yeni görev</h2>
        <TaskForm projectId={id} services={options} profiles={profiles || []} />
      </Card>
    </>
  );
}
