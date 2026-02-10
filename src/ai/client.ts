// src/ai/client.ts
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "../agent/prompt";

const client = new OpenAI({
  apiKey: 
});

export async function callAI(conversation: any[]) {
  console.log("🟪 [AI] Calling AI with conversation:");
  console.dir(conversation, { depth: null });

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversation
    ],
    response_format: { type: "json_object" }
  });

  const raw = res.choices[0].message.content!;
  console.log("🟪 [AI] Raw AI response:", raw);

  const parsed = JSON.parse(raw);
  console.log("🟪 [AI] Parsed AI response:", parsed);

  return parsed;
}
