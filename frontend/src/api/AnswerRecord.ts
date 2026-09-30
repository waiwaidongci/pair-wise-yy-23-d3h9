import { getAllRows, idbRequest, runTransaction } from "../idb/repository";
import { ApiError } from "../utils/errors";
import type { AnswerRecord } from "../types/AnswerRecord";

const endpoint = "/api/answer-record";

export async function listAnswerRecord(): Promise<AnswerRecord[]> {
  try {
    return await getAllRows("answerRecord");
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}

export async function saveAnswerRecord(payload: AnswerRecord): Promise<AnswerRecord> {
  try {
    await runTransaction(["answerRecord"], "readwrite", async (stores) => {
      await idbRequest(stores.answerRecord.put(payload));
    });
    return payload;
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}
