"use client";

import { useState } from "react";
import { useComments, useAddComment, useDeleteComment } from "@/hooks/use-comments";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { UserRole } from "@/types";

export function TicketComments({ ticketId }: { ticketId: string }) {
  const { data, isLoading } = useComments(ticketId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    addComment.mutate(
      { ticketId, content: content.trim() },
      {
        onSuccess: () => {
          setContent("");
          toast.success("Comentario agregado");
        },
        onError: () => toast.error("Error al agregar comentario"),
      }
    );
  };

  const handleDelete = (commentId: string) => {
    if (!confirm("Eliminar este comentario?")) return;
    deleteComment.mutate(
      { ticketId, commentId },
      {
        onSuccess: () => toast.success("Comentario eliminado"),
        onError: () => toast.error("Error al eliminar"),
      }
    );
  };

  const comments = data?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversacion ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay comentarios aun
          </p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {comments.map((comment) => {
              const isOwn = comment.userId === user?.id;
              const initials = comment.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={comment.id} className="flex gap-3 group">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {comment.user.role === "AGENT" || comment.user.role === "ADMIN" ? "Agente" : "Cliente"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {(isOwn || user?.role === UserRole.ADMIN) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t">
          <Textarea
            placeholder="Escribe un comentario..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || addComment.isPending}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
