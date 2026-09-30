import { getAllRows, idbRequest, runTransaction } from "../idb/repository";
import { ApiError } from "../utils/errors";
import type { PracticeSession } from "../types/PracticeSession";

const endpoint = "/api/practice-session";

export async function listPracticeSession(): Promise<PracticeSession[]> {
  try {
    return await getAllRows("practiceSession");
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}

export async function savePracticeSession(payload: PracticeSession): Promise<PracticeSession> {
  try {
    await runTransaction(["practiceSession"], "readwrite", async (stores) => {
      await idbRequest(stores.practiceSession.put(payload));
    });
    return payload;
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}
