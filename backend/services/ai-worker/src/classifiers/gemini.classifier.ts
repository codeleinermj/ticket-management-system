import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClassificationSchema, SYSTEM_PROMPT } from "./types";
import type { AIClassifier, Classification, TicketInput } from "./types";

export class GeminiClassifier implements AIClassifier {
  name = "Gemini";
  private model;

  constructor(apiKey: string, model: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 500,
      },
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  async classify(ticket: TicketInput): Promise<Classification> {
    const result = await this.model.generateContent(
      `Title: ${ticket.title}\n\nDescription: ${ticket.description}`
    );

    const content = result.response.text();
    if (!content) {
      throw new Error("Empty response from Gemini");
    }

    return ClassificationSchema.parse(JSON.parse(content));
  }
}
