"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { TaskForm, TaskStatus } from "@/components/forms/task-form";

type Option = { id: string; name: string };
type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export const OPEN_TASK_DIALOG_EVENT = "welistup:open-task-dialog";

const statusLabels: Record<TaskStatus, string> = {
  todo: "Yapılacak",
  in_progress: "Devam Ediyor",
  waiting_client: "Müşteriden Dönüş",
  review: "Kontrol / Onay",
  completed: "Tamamlandı",
};

export function TaskCreateDialog({
  projectId,
  services,
  profiles,
}: {
  projectId: string;
  services: Option[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TaskStatus>("todo");

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function openFromKanban(event: Event) {
      const detail = (event as CustomEvent<{ status?: TaskStatus }>).detail;
      setStatus(detail?.status || "todo");
      setOpen(true);
    }
    window.addEventListener(OPEN_TASK_DIALOG_EVENT, openFromKanban);
    return () =>
      window.removeEventListener(OPEN_TASK_DIALOG_EVENT, openFromKanban);
  }, []);

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", escape);
    };
  }, [close, open]);

  function completed() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus("todo");
          setOpen(true);
        }}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white transition hover:bg-[#A90912]"
      >
        <Plus className="mr-2" size={17} /> Yeni görev oluştur
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2
                  id="new-task-title"
                  className="text-xl font-bold text-slate-950"
                >
                  Yeni görev oluştur
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {statusLabels[status]} listesine eklenecek.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Kapat"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={20} />
              </button>
            </header>
            <div className="p-6">
              <TaskForm
                key={`${status}-${open}`}
                projectId={projectId}
                services={services}
                profiles={profiles}
                defaultStatus={status}
                onSuccess={completed}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
