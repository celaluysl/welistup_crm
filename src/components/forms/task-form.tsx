"use client";

import { useActionState, useEffect } from "react";
import { createTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

type Option = { id: string; name: string };
type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};
export type TaskStatus =
  "todo" | "in_progress" | "waiting_client" | "review" | "completed";

export function TaskForm({
  projectId,
  services,
  profiles,
  defaultStatus = "todo",
  onSuccess,
}: {
  projectId: string;
  services: Option[];
  profiles: Profile[];
  defaultStatus?: TaskStatus;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(createTask, null);

  useEffect(() => {
    if (state?.success) onSuccess?.();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="status" value={defaultStatus} />
      <Field label="Görev başlığı" className="sm:col-span-2">
        <input name="title" required autoFocus className={inputClass} />
      </Field>
      <Field label="Proje hizmeti">
        <select
          name="project_service_id"
          className={inputClass}
          defaultValue={services[0]?.id || ""}
        >
          <option value="">Genel proje görevi</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Öncelik">
        <select name="priority" className={inputClass} defaultValue="normal">
          <option value="normal">Normal</option>
          <option value="low">Düşük</option>
          <option value="high">Yüksek</option>
          <option value="urgent">Acil</option>
        </select>
      </Field>
      <Field label="Başlangıç">
        <input name="start_date" type="date" className={inputClass} />
      </Field>
      <Field label="Son tarih">
        <input name="due_date" type="date" className={inputClass} />
      </Field>
      <Field label="Atanan kullanıcılar" className="sm:col-span-2">
        <select name="assignees" multiple className={`${inputClass} h-28 py-2`}>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {`${profile.first_name} ${profile.last_name}`.trim() ||
                profile.email}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Açıklama" className="sm:col-span-2">
        <textarea
          name="description"
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Oluşturuluyor…" : "Görev oluştur"}
        </Button>
      </div>
    </form>
  );
}
