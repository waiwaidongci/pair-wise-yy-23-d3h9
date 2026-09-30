import { getAllRows, idbRequest, runTransaction } from "../idb/repository";
import { ApiError } from "../utils/errors";
import type { Lesson } from "../types/Lesson";

const endpoint = "/api/lesson";

export async function listLesson(): Promise<Lesson[]> {
  try {
    return await getAllRows("lesson");
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}

export async function saveLesson(payload: Lesson): Promise<Lesson> {
  try {
    await runTransaction(["lesson"], "readwrite", async (stores) => {
      await idbRequest(stores.lesson.put(payload));
    });
    return payload;
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}
