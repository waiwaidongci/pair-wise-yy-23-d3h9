import { database } from "../db/database";
import type { AnswerRecord } from "../types/AnswerRecord";

const endpoint = "/api/answer-record";

export async function listAnswerRecord(): Promise<AnswerRecord[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local mock fallback keeps the UI available during offline review.
    }
  }
  return database.getAll<AnswerRecord>("answerRecord");
}

export async function saveAnswerRecord(payload: AnswerRecord) {
  console.info("save AnswerRecord", payload);
  return payload;
}
