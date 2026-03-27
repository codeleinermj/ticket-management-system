"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useComments, useAddComment, useDeleteComment } from "@/hooks/use-comments";
import { useAuthStore } from "@/stores/auth";
import { onNewComment } from "@/hooks/use-socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Send, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { UserRole } from "@/types";

export function TicketComments({ ticketId }: { ticketId: string }) {
  const { data, isLoading } = useComments(ticketId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevCountRef = useRef(0);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
    setShowNewMessage(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottomRef.current) {
      setShowNewMessage(false);
    }
  }, []);

  // Auto-scroll when new comments arrive
  const comments = data?.data || [];
  useEffect(() => {
    if (comments.length > prevCountRef.current) {
      const lastComment = comments[comments.length - 1];
      const isOwnMessage = lastComment?.userId === user?.id;

      if (isOwnMessage || isAtBottomRef.current) {
        // Always scroll for own messages, or if already at bottom
        setTimeout(() => scrollToBottom(), 50);
      } else {
        // Show "new message" indicator
        setShowNewMessage(true);
      }
    }
    prevCountRef.current = comments.length;
  }, [comments.length, user?.id, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [isLoading]);

  // Listen for real-time comment events on this ticket
  useEffect(() => {
    const unsubscribe = onNewComment(ticketId, (event) => {
      // The query invalidation already happens in use-socket.ts
      // This listener just ensures the chat knows about new messages
      const isOwnComment = event.data.userId === user?.id;
      if (!isOwnComment && !isAtBottomRef.current) {
        setShowNewMessage(true);
      }
    });
    return unsubscribe;
  }, [ticketId, user?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    addComment.mutate(
      { ticketId, content: content.trim() },
      {
        onSuccess: () => {
          setContent("");
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
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="space-y-4 max-h-96 overflow-y-auto scroll-smooth"
            >
              {comments.map((comment) => {
                const isOwn = comment.userId === user?.id;
                const isAgentOrAdmin =
                  comment.user.role === "AGENT" || comment.user.role === "ADMIN";
                const initials = comment.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={comment.id}
                    className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={`text-xs ${isAgentOrAdmin ? "bg-primary text-primary-foreground" : ""}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex-1 min-w-0 ${isOwn ? "text-right" : ""}`}>
                      <div className={`inline-block rounded-lg px-3 py-2 max-w-[85%] ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      } ${isOwn ? "text-left" : ""}`}>
                        <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                          <span className={`text-xs font-medium ${isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {comment.user.name}
                          </span>
                          <span className={`text-xs ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {isAgentOrAdmin ? "Agente" : "Cliente"}
                          </span>
                          {(isOwn || user?.role === UserRole.ADMIN) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                        <span className={`text-[10px] mt-1 block ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground/70"}`}>
                          {new Date(comment.createdAt).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New message indicator */}
            {showNewMessage && (
              <button
                onClick={() => scrollToBottom()}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg animate-bounce cursor-pointer"
              >
                <ArrowDown className="h-3 w-3" />
                Nuevo mensaje
              </button>
            )}
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
