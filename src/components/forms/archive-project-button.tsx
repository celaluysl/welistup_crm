"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { archiveProject } from "@/lib/actions/core";
import { Button } from "@/components/ui/button";

export function ArchiveProjectButton({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      title="Projeyi arşivle"
      aria-label="Projeyi arşivle"
      className={compact ? "size-8 rounded-md p-0" : undefined}
      onClick={() => {
        if (confirm("Proje arşivlensin mi? Hizmet ve fiyat geçmişi korunacak."))
          start(() => archiveProject(id));
      }}
    >
      {compact ? <Archive size={14} /> : pending ? "Arşivleniyor…" : "Arşivle"}
    </Button>
  );
}
