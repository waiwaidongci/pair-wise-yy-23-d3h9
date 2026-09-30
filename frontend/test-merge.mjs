// 归并逻辑验证脚本（Node 环境，mock localStorage）
import { mockData } from "./src/mocks/seedData";

const store = {};
globalThis.localStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => {
    store[key] = value;
  },
  removeItem: (key) => {
    delete store[key];
  }
};

// 动态导入，确保 localStorage mock 就绪
const { database } = await import("./src/db/database");
const { executeMerge, rollbackMerge, previewMerge, resolveSymbolId } = await import(
  "./src/services/mergeService"
);
const { computeMistakeBook, computeProgress } = await import("./src/services/statsService");

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

console.log("=== 初始状态 ===");
const initialSymbols = database.getAll("brailleSymbol");
assert(initialSymbols.length === 21, `初始有 21 张卡片（实际 ${initialSymbols.length}）`);
const dup = initialSymbols.find((s) => s.id === 21);
assert(dup?.cell_pattern === "1", "重复卡片 id 21 点位为 1");

console.log("\n=== 归并预览 ===");
const preview = previewMerge(21, 1);
assert(preview.affected_lessons.length === 1, `受影响课程 1 门（实际 ${preview.affected_lessons.length}）`);
assert(preview.affected_lessons[0].id === 5, "受影响课程为 id 5");
assert(preview.impacted_sessions.length === 2, `受影响会话 2 个（实际 ${preview.impacted_sessions.length}）`);
assert(preview.affected_answer_records.length === 2, `受影响答题记录 2 条（实际 ${preview.affected_answer_records.length}）`);
assert(preview.conflict_warning !== null, "同位点字符有冲突提示");

console.log("\n=== 执行归并 ===");
const result = executeMerge({ request_id: "req-test-1", source_symbol_id: 21, target_symbol_id: 1 });
assert(result.migrated_lesson_count === 1, `迁移课程 1 门（实际 ${result.migrated_lesson_count}）`);
assert(result.migrated_answer_record_count === 2, `迁移答题记录 2 条（实际 ${result.migrated_answer_record_count}）`);
assert(result.idempotent_replay === false, "首次归并非幂等重放");

const afterMergeSymbols = database.getAll("brailleSymbol");
assert(afterMergeSymbols.length === 20, `归并后 20 张卡片（实际 ${afterMergeSymbols.length}）`);
assert(!afterMergeSymbols.some((s) => s.id === 21), "待并入卡片 id 21 已删除");

const lesson5 = database.getAll("lesson").find((l) => l.id === 5);
assert(
  JSON.stringify(lesson5.symbol_ids) === JSON.stringify([1]),
  `课程 5 symbol_ids 归并为 [1]（实际 ${JSON.stringify(lesson5.symbol_ids)})`
);

const records56 = database.getAll("answerRecord").filter((r) => r.id === 5 || r.id === 6);
assert(
  records56.every((r) => r.symbol_id === 1),
  "答题记录 5、6 的 symbol_id 已迁到 1"
);

console.log("\n=== 旧编号保留来源 ===");
assert(resolveSymbolId(21) === 1, "旧编号 21 解析到保留卡片 1");
assert(resolveSymbolId(1) === 1, "保留编号 1 解析为自身");

console.log("\n=== 错题本与进度重算 ===");
const mistakeBook = computeMistakeBook();
const symbol1Mistakes = mistakeBook.find((e) => e.symbol_id === 1);
assert(symbol1Mistakes?.mistake_count === 1, `保留卡片 1 错题数为 1（实际 ${symbol1Mistakes?.mistake_count}）`);
const progress = computeProgress();
const lesson5Progress = progress.find((p) => p.lesson_id === 5);
assert(lesson5Progress !== undefined, "课程 5 进度已重算");

console.log("\n=== 幂等恢复（同请求编号重试） ===");
const replay = executeMerge({ request_id: "req-test-1", source_symbol_id: 21, target_symbol_id: 1 });
assert(replay.idempotent_replay === true, "同请求编号返回幂等重放");
assert(replay.merge.status === "COMMITTED", "幂等重放状态为 COMMITTED");
const afterReplaySymbols = database.getAll("brailleSymbol");
assert(afterReplaySymbols.length === 20, "幂等重放不重复删除卡片");

console.log("\n=== 并发冲突（两台设备） ===");
// 模拟另一台设备：先手动提交一个变更使版本变化，再尝试归并
const versionBefore = database.getVersion();
database.mutate((draft) => {
  draft.brailleSymbol.push({ id: 99, cell_pattern: "99", letter: "z", pinyin: "z", category: "LETTER", difficulty: "1", audio_hint_key: "z" });
});
assert(database.getVersion() === versionBefore + 1, "模拟设备提交后版本号增加");

// 此时源卡片已被归并，幂等重放应找到已提交记录
const conflictReplay = executeMerge({ request_id: "req-test-2", source_symbol_id: 21, target_symbol_id: 1 });
assert(conflictReplay.idempotent_replay === true, "源卡片已归并时幂等重放返回原结果");

console.log("\n=== 拆回（按快照） ===");
// 清理冲突测试中添加的符号 99，避免影响拆回断言
database.mutate((draft) => {
  draft.brailleSymbol = draft.brailleSymbol.filter((s) => s.id !== 99);
});
const rolledBack = rollbackMerge("req-test-1");
assert(rolledBack.status === "ROLLED_BACK", "拆回后状态为 ROLLED_BACK");
const afterRollbackSymbols = database.getAll("brailleSymbol");
assert(afterRollbackSymbols.length === 21, `拆回后恢复 21 张卡片（实际 ${afterRollbackSymbols.length}）`);
assert(afterRollbackSymbols.some((s) => s.id === 21), "待并入卡片 id 21 已恢复");

const lesson5After = database.getAll("lesson").find((l) => l.id === 5);
assert(
  JSON.stringify(lesson5After.symbol_ids) === JSON.stringify([21, 1]),
  `课程 5 symbol_ids 拆回为 [21, 1]（实际 ${JSON.stringify(lesson5After.symbol_ids)})`
);

const records56After = database.getAll("answerRecord").filter((r) => r.id === 5 || r.id === 6);
assert(
  records56After.every((r) => r.symbol_id === 21),
  "答题记录 5、6 的 symbol_id 拆回为 21"
);

assert(resolveSymbolId(21) === 21, "拆回后旧编号 21 解析回自身");

console.log("\n=== 重复拆回拒绝 ===");
try {
  rollbackMerge("req-test-1");
  assert(false, "重复拆回应抛错");
} catch (e) {
  assert(e.code === "MERGE_ALREADY_ROLLED_BACK", `重复拆回抛 MERGE_ALREADY_ROLLED_BACK（实际 ${e.code}）`);
}

console.log("\n=== 校验错误 ===");
try {
  executeMerge({ request_id: "req-bad", source_symbol_id: 1, target_symbol_id: 1 });
  assert(false, "相同卡片归并应抛错");
} catch (e) {
  assert(e.code === "MERGE_SOURCE_TARGET_SAME", `相同卡片抛 MERGE_SOURCE_TARGET_SAME（实际 ${e.code}）`);
}

console.log("\n=== 乐观锁 CAS 冲突（两台设备并发） ===");
// 设备 A 读取版本号
const versionA = database.getVersion();
// 设备 B 先提交，版本号增加
database.mutate((draft) => {
  draft.brailleSymbol.push({ id: 100, cell_pattern: "100", letter: "y", pinyin: "y", category: "LETTER", difficulty: "1", audio_hint_key: "y" });
});
// 设备 A 用旧版本号 CAS，应失败
const casResult = database.cas((draft) => {
  draft.brailleSymbol.push({ id: 101, cell_pattern: "101", letter: "x", pinyin: "x", category: "LETTER", difficulty: "1", audio_hint_key: "x" });
}, versionA);
assert(casResult === false, "旧版本号 CAS 返回 false（冲突）");
// 设备 A 的变更未生效
assert(!database.getAll("brailleSymbol").some((s) => s.id === 101), "冲突变更未写入，不留下半套引用");
// 清理
database.mutate((draft) => {
  draft.brailleSymbol = draft.brailleSymbol.filter((s) => s.id !== 100);
});

console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===`);
if (failed > 0) process.exit(1);
