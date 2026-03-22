"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  ThumbsUp,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAcceptAiClassification,
  useCorrectAiClassification,
} from "@/hooks/use-tickets";
import { AiStatus, TicketCategory, TicketPriority } from "@/types";
import { cn } from "@/lib/utils";

interface AiSuggestionProps {
  ticketId: string;
  aiResponse: string | null;
  aiStatus: AiStatus;
  confidence: number | null;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  isAgent: boolean;
  onApply?: (text: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  let colorClass: string;
  let label: string;

  if (confidence >= 0.8) {
    colorClass = "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    label = "Alta confianza";
  } else if (confidence >= 0.5) {
    colorClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    label = "Confianza media";
  } else {
    colorClass = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    label = "Baja confianza";
  }

  return (
    <Badge variant="secondary" className={cn("text-xs", colorClass)}>
      {label} ({percentage}%)
    </Badge>
  );
}

const categoryLabels: Record<TicketCategory, string> = {
  BUG: "Bug",
  FEATURE_REQUEST: "Feature Request",
  SUPPORT: "Soporte",
  BILLING: "Facturacion",
  OTHER: "Otro",
};

const priorityLabels: Record<TicketPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Critica",
};

export function AiSuggestion({
  ticketId,
  aiResponse,
  aiStatus,
  confidence,
  category,
  priority,
  isAgent,
  onApply,
}: AiSuggestionProps) {
  const [copied, setCopied] = useState(false);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [correctedCategory, setCorrectedCategory] = useState<string>("");
  const [correctedPriority, setCorrectedPriority] = useState<string>("");

  const acceptMutation = useAcceptAiClassification();
  const correctMutation = useCorrectAiClassification();

  // PENDING state
  if (aiStatus === AiStatus.PENDING) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mb-2 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Clasificando con IA...</p>
          <p className="text-xs">
            La IA esta analizando este ticket automaticamente
          </p>
        </CardContent>
      </Card>
    );
  }

  // FAILED state
  if (aiStatus === AiStatus.FAILED) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">La clasificacion de IA fallo</p>
          <p className="text-xs">
            Este ticket requiere revision manual
          </p>
        </CardContent>
      </Card>
    );
  }

  // CLASSIFIED state
  if (!aiResponse) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(aiResponse);
    setCopied(true);
    toast.success("Respuesta copiada al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = () => {
    acceptMutation.mutate(ticketId, {
      onSuccess: () => toast.success("Clasificacion de IA aceptada"),
      onError: () => toast.error("Error al aceptar la clasificacion"),
    });
  };

  const handleCorrect = () => {
    const corrections: Record<string, string> = {};
    if (correctedCategory) corrections.category = correctedCategory;
    if (correctedPriority) corrections.priority = correctedPriority;

    if (Object.keys(corrections).length === 0) {
      toast.error("Selecciona al menos un campo para corregir");
      return;
    }

    correctMutation.mutate(
      { ticketId, corrections },
      {
        onSuccess: () => {
          toast.success("Clasificacion corregida");
          setShowCorrectForm(false);
        },
        onError: () => toast.error("Error al corregir la clasificacion"),
      },
    );
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugerencia de IA
          </CardTitle>
          {confidence !== null && <ConfidenceBadge confidence={confidence} />}
        </div>
        {category && priority && (
          <div className="flex gap-2 pt-1">
            <Badge variant="outline" className="text-xs">
              {categoryLabels[category] || category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Prioridad: {priorityLabels[priority] || priority}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="max-h-48">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {aiResponse}
          </p>
        </ScrollArea>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {onApply && (
            <Button size="sm" onClick={() => onApply(aiResponse)}>
              <Sparkles className="mr-1 h-3 w-3" />
              Aplicar sugerencia
            </Button>
          )}
          {isAgent && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAccept}
                disabled={acceptMutation.isPending}
                className="text-green-600 hover:text-green-700"
              >
                <ThumbsUp className="mr-1 h-3 w-3" />
                {acceptMutation.isPending ? "Aceptando..." : "Aceptar clasificacion"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCorrectForm(!showCorrectForm)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Corregir
              </Button>
            </>
          )}
        </div>

        {showCorrectForm && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Corregir clasificacion</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Select value={correctedCategory} onValueChange={(v) => setCorrectedCategory(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin cambios" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prioridad</label>
                <Select value={correctedPriority} onValueChange={(v) => setCorrectedPriority(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin cambios" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCorrect}
                disabled={correctMutation.isPending}
              >
                {correctMutation.isPending ? "Guardando..." : "Guardar correccion"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCorrectForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
