"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, Download, Trash2, Upload, FileText, Image } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/types";
import { UserRole } from "@/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function TicketAttachments({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canDelete = user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN;

  const { data, isLoading } = useQuery({
    queryKey: ["attachments", ticketId],
    queryFn: () => api.getAttachments(ticketId),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAttachment(ticketId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", ticketId] });
      toast.success("Archivo subido");
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Error al subir archivo");
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", ticketId] });
      toast.success("Archivo eliminado");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload.mutate(file);
      e.target.value = "";
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const res = await api.downloadAttachment(attachment.id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar archivo");
    }
  };

  const attachments: Attachment[] = data?.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Adjuntos ({attachments.length})
        </CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xlsx,.txt,.csv"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="mr-1 h-4 w-4" />
            {upload.isPending ? "Subiendo..." : "Subir"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!isLoading && attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin adjuntos</p>
        )}
        {attachments.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                {isImage(att.mimeType) ? (
                  <Image className="h-8 w-8 shrink-0 text-blue-500" />
                ) : (
                  <FileText className="h-8 w-8 shrink-0 text-gray-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.size)} · {att.uploadedBy?.name}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(att)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteAttachment.mutate(att.id)}
                      disabled={deleteAttachment.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
