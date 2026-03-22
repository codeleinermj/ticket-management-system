import OpenAI from "openai";
import { ClassificationSchema, SYSTEM_PROMPT } from "./types";
import type { AIClassifier, Classification, TicketInput } from "./types";

export class OpenAIClassifier implements AIClassifier {
  name = "OpenAI";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async classify(ticket: TicketInput): Promise<Classification> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Title: ${ticket.title}\n\nDescription: ${ticket.description}` },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return ClassificationSchema.parse(JSON.parse(content));
  }
}
