import type { AIClassifier, Classification, TicketInput } from "./types";

const KEYWORD_RULES: { keywords: string[]; category: Classification["category"]; priority: Classification["priority"] }[] = [
  { keywords: ["crash", "error", "bug", "falla", "roto", "broken", "500", "exception"], category: "BUG", priority: "HIGH" },
  { keywords: ["security", "seguridad", "hack", "breach", "vulnerability"], category: "BUG", priority: "CRITICAL" },
  { keywords: ["feature", "funcionalidad", "añadir", "agregar", "request", "mejora"], category: "FEATURE_REQUEST", priority: "LOW" },
  { keywords: ["billing", "factura", "cobro", "pago", "payment", "charge", "precio"], category: "BILLING", priority: "MEDIUM" },
  { keywords: ["help", "ayuda", "how", "cómo", "question", "pregunta", "support"], category: "SUPPORT", priority: "MEDIUM" },
];

const RESPONSES: Record<Classification["category"], string> = {
  BUG: "Hemos registrado el bug reportado. Nuestro equipo técnico lo está investigando.",
  FEATURE_REQUEST: "Gracias por su sugerencia. La hemos registrado para evaluación del equipo de producto.",
  SUPPORT: "Gracias por contactarnos. Un agente revisará su consulta a la brevedad.",
  BILLING: "Hemos recibido su consulta de facturación. El equipo de finanzas la revisará.",
  OTHER: "Hemos recibido su solicitud. Un agente la revisará pronto.",
};

export class MockClassifier implements AIClassifier {
  name = "Mock";
  private delay: number;

  constructor(delay = 200) {
    this.delay = delay;
  }

  async classify(ticket: TicketInput): Promise<Classification> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, this.delay));

    const text = `${ticket.title} ${ticket.description}`.toLowerCase();

    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return {
          category: rule.category,
          priority: rule.priority,
          suggestedResponse: RESPONSES[rule.category],
          confidence: 0.85,
        };
      }
    }

    return {
      category: "OTHER",
      priority: "MEDIUM",
      suggestedResponse: RESPONSES.OTHER,
      confidence: 0.6,
    };
  }
}
