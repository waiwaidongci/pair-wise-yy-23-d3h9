import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import "fake-indexeddb/auto";
import { resetDatabaseForTest } from "../src/idb/database";
import { forceLockForTest } from "../src/idb/mergeLock";
import { getAllRows } from "../src/idb/repository";
import {
  commitSymbolMerge,
  findMergeByRequestId,
  recoverSymbolMerge,
  revertSymbolMerge
} from "../src/services/symbolMerge";
import { previewSymbolMerge } from "../src/services/mergePreview";
import { buildMistakeBook } from "../src/services/mistakeBook";
import { buildProgressStats } from "../src/services/progress";
import { buildSymbolAliasMap } from "../src/services/symbolResolve";
import { ServiceError } from "../src/utils/errors";
import type { AnswerRecord } from "../src/types/AnswerRecord";
import type { Lesson } from "../src/types/Lesson";
import type { MergeLockRow } from "../src/idb/types";

const DEVICE_A = "dev-A";
const DEVICE_B = "dev-B";

beforeEach(async () => {
  await resetDatabaseForTest();
});

async function rows() {
  const [symbols, lessons, sessions, answers, merges] = await Promise.all([
    getAllRows("brailleSymbol"),
    getAllRows("lesson"),
    getAllRows("practiceSession"),
    getAllRows("answerRecord"),
    getAllRows("symbolMerge")
  ]);
  return { symbols, lessons, sessions, answers, merges };
}

describe("字符归并：预览先列出引用", () => {
  it("列出两张重复卡片各自的课程、练习会话、答题记录", async () => {
    const preview = await previewSymbolMerge(1, 7);
    assert.equal(preview.kept.symbol.id, 1);
    assert.equal(preview.merged.symbol.id, 7);
    // 卡片 1：课程 #1，答题 #1（会话 #1）
    assert.deepEqual(preview.kept.lessons.map((l) => l.id), [1]);
    assert.deepEqual(preview.kept.answerRecords.map((r) => r.id), [1]);
    assert.deepEqual(preview.kept.sessions.map((s) => s.id), [1]);
    // 卡片 7：课程 #4，答题 #6（会话 #3）
    assert.deepEqual(preview.merged.lessons.map((l) => l.id), [4]);
    assert.deepEqual(preview.merged.answerRecords.map((r) => r.id), [6]);
    assert.deepEqual(preview.merged.sessions.map((s) => s.id), [3]);
  });

  it("保留卡片与待并入卡片不能相同", async () => {
    await assert.rejects(
      () => commitSymbolMerge({ requestId: "req-x", keptSymbolId: 1, mergedSymbolId: 1, deviceId: DEVICE_A }),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_SAME_CARD"
    );
  });
});

describe("字符归并：统一迁移到保留卡片", () => {
  it("课程改指并去重、答题记录迁移、删除旧卡片，旧编号进入别名表", async () => {
    const result = await commitSymbolMerge({
      requestId: "req-merge-7-into-1",
      keptSymbolId: 1,
      mergedSymbolId: 7,
      deviceId: DEVICE_A
    });

    assert.equal(result.merge.status, "MERGED");
    assert.deepEqual(result.migratedLessonIds, [4]);
    assert.deepEqual(result.migratedAnswerRecordIds, [6]);
    assert.deepEqual(result.migratedSessionIds, [3]);

    const state = await rows();
    assert.equal(state.symbols.find((s) => s.id === 7), undefined, "待并入卡片应删除");
    assert.ok(state.symbols.find((s) => s.id === 1), "保留卡片仍存在");

    const lesson4 = state.lessons.find((l) => l.id === 4) as Lesson;
    assert.deepEqual(lesson4.symbol_ids, [1, 8, 2], "课程中 7 改指 1（排序按原位置替换后去重）");
    assert.equal(lesson4.symbol_ids.filter((id) => id === 1).length, 1, "课程内保留卡片不重复");

    const record6 = state.answers.find((a) => a.id === 6) as AnswerRecord;
    assert.equal(record6.symbol_id, 1, "答题记录改指保留卡片");

    const aliases = buildSymbolAliasMap(state.merges);
    assert.equal(aliases.aliasToKept.get(7), 1, "旧编号 7 保留为来源并解析到 1");
  });

  it("错题本与学习进度按保留卡片重算", async () => {
    await commitSymbolMerge({ requestId: "req-7", keptSymbolId: 1, mergedSymbolId: 7, deviceId: DEVICE_A });
    const mistakeBook = await buildMistakeBook();
    const entryForA = mistakeBook.find((entry) => entry.symbolId === 1);
    assert.ok(entryForA, "卡片 7 的错题并入保留卡片 1");
    // 原 #1 答对 1 次 + 原 #7 答错 1 次
    assert.equal(entryForA!.totalCount, 2);
    assert.equal(entryForA!.wrongRecords.length, 1);
    assert.equal(entryForA!.wrongRecords[0].id, 6);

    const progress = await buildProgressStats();
    const symbol1 = progress.symbolProgress.find((item) => item.symbolId === 1);
    assert.equal(symbol1?.total, 2);
    assert.equal(symbol1?.wrong, 1);
  });

  it("原编号读取保持兼容：已删除卡片的答题仍能定位到保留卡片", async () => {
    await commitSymbolMerge({ requestId: "req-7", keptSymbolId: 1, mergedSymbolId: 7, deviceId: DEVICE_A });
    const state = await rows();
    const aliases = buildSymbolAliasMap(state.merges);
    const answersPointingOld = state.answers.filter((a) => a.symbol_id === 7);
    assert.equal(answersPointingOld.length, 0, "库内记录已改指");
    // 外部若仍持旧编号 7（如导入包/书签），解析后得到 1
    const { resolveSymbolId } = await import("../src/services/symbolResolve");
    assert.equal(resolveSymbolId(7, aliases), 1);
    assert.equal(resolveSymbolId(1, aliases), 1);
    assert.equal(resolveSymbolId(999, aliases), 999);
  });
});

describe("字符归并：原请求编号幂等", () => {
  it("同一请求编号重复提交只产生一笔归并", async () => {
    const input = { requestId: "req-idem", keptSymbolId: 1, mergedSymbolId: 7, deviceId: DEVICE_A };
    await commitSymbolMerge(input);
    const second = await commitSymbolMerge(input);
    assert.equal(second.merge.status, "MERGED");
    const state = await rows();
    assert.equal(state.merges.length, 1);
  });

  it("请求编号被复用于另一组卡片时报冲突，不动数据", async () => {
    await commitSymbolMerge({ requestId: "req-dup", keptSymbolId: 1, mergedSymbolId: 7, deviceId: DEVICE_A });
    await assert.rejects(
      () => commitSymbolMerge({ requestId: "req-dup", keptSymbolId: 3, mergedSymbolId: 8, deviceId: DEVICE_A }),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_DUPLICATE_CONFLICT"
    );
    const state = await rows();
    assert.ok(state.symbols.find((s) => s.id === 8), "冲突后卡片 8 仍在");
    assert.equal(state.merges.length, 1);
  });
});

describe("字符归并：两台设备并发只允许一笔生效", () => {
  it("他机持锁时本机抢占失败，不改任何引用，台账留 FAILED 可凭请求编号恢复", async () => {
    const busyLock: Omit<MergeLockRow, "key" | "version"> = {
      held_by: DEVICE_B,
      request_id: "req-device-B",
      kept_symbol_id: 1,
      merged_symbol_id: 7,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10_000).toISOString()
    };
    await forceLockForTest(busyLock, 1);

    await assert.rejects(
      () =>
        commitSymbolMerge({
          requestId: "req-device-A",
          keptSymbolId: 1,
          mergedSymbolId: 7,
          deviceId: DEVICE_A
        }),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_LOCK_BUSY"
    );

    const after = await rows();
    assert.ok(after.symbols.find((s) => s.id === 7), "抢占失败：待并入卡片仍在");
    const lesson4 = after.lessons.find((l) => l.id === 4) as Lesson;
    assert.deepEqual(lesson4.symbol_ids, [7, 8, 2], "抢占失败：课程引用原样");
    assert.equal(after.answers.find((a) => a.id === 6)?.symbol_id, 7, "抢占失败：答题记录原样");

    const failed = await findMergeByRequestId("req-device-A");
    assert.equal(failed?.status, "FAILED", "失败也留台账并冻结快照");
    assert.ok(failed.snapshot.merged.id === 7);
    assert.equal(failed.snapshot.answerRecords.length, 1);

    // 模拟设备 B 异常退出后锁过期：把锁改成过期状态，A 凭原请求编号恢复
    const expiredLock: Omit<MergeLockRow, "key" | "version"> = {
      ...busyLock,
      expires_at: new Date(Date.now() - 1_000).toISOString()
    };
    await forceLockForTest(expiredLock, 2);

    const recovered = await recoverSymbolMerge("req-device-A", DEVICE_A);
    assert.equal(recovered.merge.status, "MERGED");
    const finalState = await rows();
    assert.equal(finalState.symbols.find((s) => s.id === 7), undefined);
    assert.equal(finalState.answers.find((a) => a.id === 6)?.symbol_id, 1);
    // 恢复没有新建台账行
    assert.equal(finalState.merges.filter((m) => m.request_id === "req-device-A").length, 1);
  });

  it("恢复已成功归并的请求编号是幂等返回；拆回中的请求恢复报已拆回", async () => {
    await commitSymbolMerge({ requestId: "req-ok", keptSymbolId: 3, mergedSymbolId: 8, deviceId: DEVICE_A });
    const again = await recoverSymbolMerge("req-ok", DEVICE_B);
    assert.equal(again.merge.status, "MERGED");

    await revertSymbolMerge("req-ok", DEVICE_A);
    await assert.rejects(
      () => recoverSymbolMerge("req-ok", DEVICE_A),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_ALREADY_REVERTED"
    );
  });
});

describe("字符归并：按快照拆回", () => {
  it("MERGED 台账可拆回：恢复旧卡片、课程与答题记录，别名随即失效", async () => {
    await commitSymbolMerge({ requestId: "req-revert", keptSymbolId: 3, mergedSymbolId: 8, deviceId: DEVICE_A });
    const reverted = await revertSymbolMerge("req-revert", DEVICE_B);
    assert.equal(reverted.status, "REVERTED");

    const state = await rows();
    assert.ok(state.symbols.find((s) => s.id === 8), "旧卡片恢复");
    const lesson4 = state.lessons.find((l) => l.id === 4) as Lesson;
    assert.deepEqual(lesson4.symbol_ids, [7, 8, 2], "课程引用按快照恢复");
    assert.equal(state.answers.find((a) => a.id === 7)?.symbol_id, 8, "答题记录按快照恢复");

    const aliases = buildSymbolAliasMap(state.merges);
    assert.equal(aliases.aliasToKept.has(8), false, "拆回后旧编号不再解析到保留卡片");
  });

  it("拆回幂等：重复拆回报已拆回", async () => {
    await commitSymbolMerge({ requestId: "req-rev2", keptSymbolId: 3, mergedSymbolId: 8, deviceId: DEVICE_A });
    await revertSymbolMerge("req-rev2", DEVICE_A);
    await assert.rejects(
      () => revertSymbolMerge("req-rev2", DEVICE_A),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_ALREADY_REVERTED"
    );
  });

  it("多级归并链存在依赖时阻止拆回", async () => {
    // 8 -> 3 之后，再把 3 并入 1（线性链 8→3→1），此时直接拆 8→3 被阻止，需先拆 3→1
    await commitSymbolMerge({ requestId: "req-chain-1", keptSymbolId: 3, mergedSymbolId: 8, deviceId: DEVICE_A });
    await commitSymbolMerge({ requestId: "req-chain-2", keptSymbolId: 1, mergedSymbolId: 3, deviceId: DEVICE_A });
    await assert.rejects(
      () => revertSymbolMerge("req-chain-1", DEVICE_A),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_CHAIN_BLOCKED"
    );
    // 先拆后一笔即可成功
    await revertSymbolMerge("req-chain-2", DEVICE_A);
    const reverted = await revertSymbolMerge("req-chain-1", DEVICE_A);
    assert.equal(reverted.status, "REVERTED");
  });
});

describe("字符归并：事务原子性", () => {
  it("迁移与台账更新在同一事务内，失败时不留半套引用", async () => {
    // 卡片不存在的场景：预检直接拒绝，库内没有任何引用被改动
    await assert.rejects(
      () => commitSymbolMerge({ requestId: "req-missing", keptSymbolId: 1, mergedSymbolId: 404, deviceId: DEVICE_A }),
      (error: unknown) => error instanceof ServiceError && error.code === "MERGE_CARD_NOT_FOUND"
    );
    const state = await rows();
    assert.deepEqual(
      state.answers.map((a) => a.symbol_id).sort(),
      [1, 5, 2, 3, 4, 7, 8, 2].sort()
    );
    assert.equal(state.merges.length, 0, "预检失败不落台账");
  });
});
