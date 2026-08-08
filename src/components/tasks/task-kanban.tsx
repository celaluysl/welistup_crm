"use client";

import Link from "next/link";
import { CalendarDays, Maximize2, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { moveTask, quickUpdateTask } from "@/lib/actions/tasks";
import { OPEN_TASK_DIALOG_EVENT } from "@/components/tasks/task-create-dialog";
import { TaskCommentForm } from "@/components/forms/task-comment-form";
import { inputClass } from "@/components/ui/field";

type Status =
  "todo" | "in_progress" | "waiting_client" | "review" | "completed";
type Task = {
  id: string;
  title: string;
  status: Status;
  priority: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  task_assignees: {
    profiles: { first_name: string; last_name: string } | null;
  }[];
  task_comments?: {
    id: string;
    body: string;
    created_at: string;
    creator: {
      first_name: string;
      last_name: string;
      email: string;
    } | null;
  }[];
};

type ColumnDefinition = {
  id: Status;
  label: string;
  border: string;
  dot: string;
  count: string;
};

const columns: ColumnDefinition[] = [
  {
    id: "todo",
    label: "Yapılacak",
    border: "border-t-slate-500",
    dot: "bg-slate-500",
    count: "bg-slate-200 text-slate-700",
  },
  {
    id: "in_progress",
    label: "Devam Ediyor",
    border: "border-t-blue-500",
    dot: "bg-blue-500",
    count: "bg-blue-100 text-blue-700",
  },
  {
    id: "waiting_client",
    label: "Müşteriden Dönüş",
    border: "border-t-amber-500",
    dot: "bg-amber-500",
    count: "bg-amber-100 text-amber-700",
  },
  {
    id: "review",
    label: "Kontrol / Onay",
    border: "border-t-violet-500",
    dot: "bg-violet-500",
    count: "bg-violet-100 text-violet-700",
  },
  {
    id: "completed",
    label: "Tamamlandı",
    border: "border-t-emerald-500",
    dot: "bg-emerald-500",
    count: "bg-emerald-100 text-emerald-700",
  },
];

const priorityLabels: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

export function TaskKanban({
  initialTasks,
  projectId,
}: {
  initialTasks: Task[];
  projectId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function changeStatus(taskId: string, status: Status) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    start(() => moveTask(task.id, projectId, status));
  }

  function ended(event: DragEndEvent) {
    const status = event.over?.id as Status | undefined;
    if (!status || !columns.some((column) => column.id === status)) return;
    changeStatus(String(event.active.id), status);
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;

  return (
    <DndContext sensors={sensors} onDragEnd={ended}>
      <div className="grid min-w-[1180px] grid-cols-5 gap-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            tasks={tasks.filter((task) => task.status === column.id)}
            projectId={projectId}
            onOpen={setSelectedTaskId}
          />
        ))}
      </div>
      {selectedTask && (
        <TaskQuickView
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={(status) => changeStatus(selectedTask.id, status)}
          onTaskUpdate={(values) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === selectedTask.id ? { ...task, ...values } : task,
              ),
            )
          }
        />
      )}
    </DndContext>
  );
}

function Column({
  column,
  tasks,
  projectId,
  onOpen,
}: {
  column: ColumnDefinition;
  tasks: Task[];
  projectId: string;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[420px] flex-col rounded-xl border border-t-4 ${column.border} ${
        isOver
          ? "border-[#CD0B16] bg-red-50"
          : "border-x-slate-200 border-b-slate-200 bg-slate-100"
      }`}
    >
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className={`size-2 rounded-full ${column.dot}`} />
          {column.label}
        </div>
        <span
          className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${column.count}`}
        >
          {tasks.length}
        </span>
      </header>

      <div className="flex-1 space-y-3 p-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            projectId={projectId}
            onOpen={onOpen}
          />
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white/70 p-2">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(OPEN_TASK_DIALOG_EVENT, {
                detail: { status: column.id },
              }),
            )
          }
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#CD0B16]"
        >
          <Plus size={17} /> Kart ekle
        </button>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  projectId,
  onOpen,
}: {
  task: Task;
  projectId: string;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });
  const assignees = task.task_assignees
    .map((item) =>
      `${item.profiles?.first_name || ""} ${item.profiles?.last_name || ""}`.trim(),
    )
    .filter(Boolean)
    .join(", ");

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`relative cursor-grab touch-none rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "z-50 opacity-60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onOpen(task.id)}
        className="block w-full text-left text-sm font-semibold text-slate-800 hover:text-[#CD0B16]"
      >
        {task.title}
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${priorityStyles[task.priority] || priorityStyles.normal}`}
        >
          {priorityLabels[task.priority] || task.priority}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
          <CalendarDays size={11} /> {formatDate(task.due_date)}
        </span>
      </div>
      {assignees && (
        <div className="mt-2 truncate text-[10px] text-slate-400">
          {assignees}
        </div>
      )}
      <div className="mt-3 flex gap-3 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpen(task.id)}
          className="text-xs font-medium text-[#CD0B16]"
        >
          Hızlı bakış
        </button>
        <Link
          href={`/projects/${projectId}/tasks/${task.id}/edit`}
          onPointerDown={(event) => event.stopPropagation()}
          className="text-xs font-medium text-slate-500"
        >
          Düzenle
        </Link>
        <Link
          href={`/projects/${projectId}/tasks/${task.id}/files`}
          onPointerDown={(event) => event.stopPropagation()}
          className="text-xs font-medium text-slate-500"
        >
          Ekler
        </Link>
      </div>
    </article>
  );
}

function TaskQuickView({
  task,
  projectId,
  onClose,
  onStatusChange,
  onTaskUpdate,
}: {
  task: Task;
  projectId: string;
  onClose: () => void;
  onStatusChange: (status: Status) => void;
  onTaskUpdate: (values: Partial<Task>) => void;
}) {
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  const assignees = task.task_assignees
    .map((item) =>
      `${item.profiles?.first_name || ""} ${item.profiles?.last_name || ""}`.trim(),
    )
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-quick-title"
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-[10px] font-semibold ${priorityStyles[task.priority] || priorityStyles.normal}`}
              >
                {priorityLabels[task.priority] || task.priority}
              </span>
              <span className="text-xs text-slate-400">
                Hızlı görev görünümü
              </span>
            </div>
            <h2
              id="task-quick-title"
              className="text-xl font-bold text-slate-950"
            >
              {task.title}
            </h2>
          </div>
          <div className="flex gap-1.5">
            <Link
              href={`/projects/${projectId}/tasks/${task.id}`}
              title="Tam sayfada aç"
              aria-label="Tam sayfada aç"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#CD0B16]"
            >
              <Maximize2 size={17} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              title="Kapat"
              aria-label="Kapat"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1.25fr_.75fr]">
          <div className="space-y-6 p-6 lg:border-r lg:border-slate-200">
            <QuickTaskEditForm
              task={task}
              projectId={projectId}
              onSaved={onTaskUpdate}
            />

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Durumu hızlı değiştir
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {columns.map((column) => (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => onStatusChange(column.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      task.status === column.id
                        ? "border-[#CD0B16] bg-red-50 text-[#CD0B16]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <QuickInfo
                label="Atananlar"
                value={assignees.join(", ") || "Atama yok"}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <Link
                href={`/projects/${projectId}/tasks/${task.id}/files`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Ekleri aç
              </Link>
              <Link
                href={`/projects/${projectId}/tasks/${task.id}/edit`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Gelişmiş düzenleme
              </Link>
            </div>
          </div>

          <aside className="bg-slate-50/60 p-6">
            <h3 className="font-bold text-slate-900">Yorumlar ve aktivite</h3>
            <div className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <TaskCommentForm projectId={projectId} taskId={task.id} />
            </div>
            <div className="mt-5 space-y-3">
              {(task.task_comments || []).map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-600">
                      {personName(comment.creator)}
                    </span>
                    <span>
                      {new Date(comment.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                    {comment.body}
                  </p>
                </div>
              ))}
              {!task.task_comments?.length && (
                <p className="py-6 text-center text-xs text-slate-400">
                  Henüz yorum eklenmemiş.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function QuickTaskEditForm({
  task,
  projectId,
  onSaved,
}: {
  task: Task;
  projectId: string;
  onSaved: (values: Partial<Task>) => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await quickUpdateTask(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      onSaved({
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || "") || null,
        priority: String(formData.get("priority") || "normal"),
        start_date: String(formData.get("start_date") || "") || null,
        due_date: String(formData.get("due_date") || "") || null,
      });
      setMessage("Değişiklikler kaydedildi.");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={task.id} />
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-500">
          Görev başlığı
        </span>
        <input
          name="title"
          required
          defaultValue={task.title}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-500">
          Açıklama
        </span>
        <textarea
          name="description"
          rows={5}
          defaultValue={task.description || ""}
          placeholder="Görev açıklamasını yazın..."
          className={`${inputClass} h-auto py-2`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500">
            Öncelik
          </span>
          <select
            name="priority"
            defaultValue={task.priority}
            className={inputClass}
          >
            <option value="low">Düşük</option>
            <option value="normal">Normal</option>
            <option value="high">Yüksek</option>
            <option value="urgent">Acil</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500">
            Başlangıç
          </span>
          <input
            name="start_date"
            type="date"
            defaultValue={task.start_date || ""}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500">
            Son tarih
          </span>
          <input
            name="due_date"
            type="date"
            defaultValue={task.due_date || ""}
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${
            message.includes("kaydedildi") ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {message}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white hover:bg-[#A90912] disabled:opacity-50"
        >
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </button>
      </div>
    </form>
  );
}

function personName(
  person: {
    first_name: string;
    last_name: string;
    email: string;
  } | null,
) {
  return person
    ? `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
        person.email
    : "Kullanıcı";
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Tarih yok";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
