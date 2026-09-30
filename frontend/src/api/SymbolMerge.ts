import { resetDatabaseForTest } from "../idb/database";
import { ApiError, ServiceError } from "../utils/errors";
import {
  commitSymbolMerge,
  findMergeByRequestId,
  listSymbolMerges,
  recoverSymbolMerge,
  revertSymbolMerge
} from "../services/symbolMerge";
import { previewSymbolMerge } from "../services/mergePreview";
import { buildMistakeBook } from "../services/mistakeBook";
import { buildProgressStats } from "../services/progress";
import type { MergeCommitResult, MergePreview, SymbolMerge } from "../types/SymbolMerge";
import type { CommitSymbolMergeInput } from "../services/symbolMerge";
import type { MistakeBookEntry } from "../services/mistakeBook";
import type { ProgressStats } from "../services/progress";

const endpoint = "/api/symbol-merge";

/** api 层统一再包一层异常，禁止调用方直接吃 service 异常 */
async function callApi<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const code = error instanceof ServiceError ? error.code : "SERVICE_ERROR";
    throw new ApiError(code, error, { endpoint });
  }
}

/** 归并预览：先列出两张卡片的课程、练习会话、答题记录引用 */
export async function previewSymbolMergeApi(keptSymbolId: number, mergedSymbolId: number): Promise<MergePreview> {
  return callApi(() => previewSymbolMerge(keptSymbolId, mergedSymbolId));
}

/** 提交归并：内部完成预写台账、抢锁、单事务迁移，失败可凭请求编号恢复 */
export async function commitSymbolMergeApi(input: CommitSymbolMergeInput): Promise<MergeCommitResult> {
  return callApi(() => commitSymbolMerge(input));
}

/** 失败后凭原请求编号恢复；已成功的请求编号幂等返回 */
export async function recoverSymbolMergeApi(requestId: string, deviceId: string): Promise<MergeCommitResult> {
  return callApi(() => recoverSymbolMerge(requestId, deviceId));
}

/** 误合时按快照拆回，并恢复旧编号来源 */
export async function revertSymbolMergeApi(requestId: string, deviceId: string): Promise<SymbolMerge> {
  return callApi(() => revertSymbolMerge(requestId, deviceId));
}

export async function listSymbolMergeApi(): Promise<SymbolMerge[]> {
  return callApi(() => listSymbolMerges());
}

export async function getSymbolMergeApi(requestId: string): Promise<SymbolMerge | undefined> {
  return callApi(() => findMergeByRequestId(requestId));
}

/** 错题本：按保留卡片重算 */
export async function getMistakeBookApi(): Promise<MistakeBookEntry[]> {
  return callApi(() => buildMistakeBook());
}

/** 学习进度：按保留卡片重算 */
export async function getProgressStatsApi(): Promise<ProgressStats> {
  return callApi(() => buildProgressStats());
}

/** 仅测试使用：恢复种子数据库 */
export async function resetDatabaseApi(): Promise<void> {
  await resetDatabaseForTest();
}
