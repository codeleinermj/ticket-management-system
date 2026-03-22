import type { AIClassifier } from "./types";
import { OpenAIClassifier } from "./openai.classifier";
import { GeminiClassifier } from "./gemini.classifier";
import { MockClassifier } from "./mock.classifier";

export type { AIClassifier, Classification, TicketInput } from "./types";
export { ClassificationSchema } from "./types";

export type ClassifierProvider = "openai" | "gemini" | "mock";

interface ClassifierConfig {
  provider: ClassifierProvider;
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export function createClassifier(cfg: ClassifierConfig): AIClassifier {
  switch (cfg.provider) {
    case "openai":
      if (!cfg.openaiApiKey) throw new Error("OPENAI_API_KEY is required for OpenAI provider");
      return new OpenAIClassifier(cfg.openaiApiKey, cfg.openaiModel || "gpt-4o-mini");

    case "gemini":
      if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is required for Gemini provider");
      return new GeminiClassifier(cfg.geminiApiKey, cfg.geminiModel || "gemini-2.0-flash");

    case "mock":
      return new MockClassifier();

    default:
      throw new Error(`Unknown classifier provider: ${cfg.provider}`);
  }
}
