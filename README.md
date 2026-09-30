# 盲文点字学习训练器

纯前端盲文点字学习与练习工具，支持点阵字符卡片、听写练习、错题本和学习进度统计，数据存 IndexedDB。支持把同一字符误建的两张卡片**归并**：先列出课程、练习会话和答题记录，再统一迁到保留卡片，旧编号保留来源、误合可按快照拆回。

## 快速启动

```bash
cp .env.example .env && docker compose up -d
```

## 访问地址或 CLI 示例

前端：<http://localhost:20111>

字符归并页：应用左侧导航「字符归并」（路由 `/merge`）。本地开发时也可直接运行测试：

```bash
cd frontend && npm install && npm test
```

## 本地开发方式

- 前端：`cd frontend && npm install && npm run dev`
- 类型检查：`cd frontend && npx tsc -b --force`
- 单元测试（fake-indexeddb + node:test）：`cd frontend && npm test`
- 生产构建：`cd frontend && npm run build`

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Material UI + Zustand + IndexedDB |
| 后端 | -（纯前端，`src/api` 为本地 IndexedDB 异步封装） |
| 数据库 | IndexedDB（库名 `braille-trainer-db`，v2） |
| 测试 | node:test + fake-indexeddb + tsx |
| 部署 | Docker Compose |

## 字符归并设计（ld-611 补充特性）

针对“同一个点字字符建成两条卡片，课程和错题记录各自引用”的问题，归并流程在 `/merge` 页完成，核心保证如下：

1. **先列引用再迁移**：`services/mergePreview` 分别汇总保留卡片与待并入卡片在课程（`lesson.symbol_ids`）、练习会话（经答题记录关联）、答题记录三处的引用，确认后才提交。
2. **统一迁到保留卡片**：单 IndexedDB 事务内改课程编号并去重、答题记录 `symbol_id` 改指保留卡片、删除待并入卡片、台账置 `MERGED`。事务失败整体回滚，**不留下半套引用**。
3. **旧编号保留来源**：新增 `symbolMerge` 台账（`merged_symbol_id → kept_symbol_id`），读路径（错题本、学习进度、练习明细）经 `services/symbolResolve` 把旧编号解析到保留卡片；多级归并沿链回溯，循环/超长链报 `MERGE_ALIAS_AMBIGUOUS`。
4. **误合按快照拆回**：台账 `snapshot` 冻结归并前的课程行、会话行、答题行与被删卡片整行，`revertSymbolMerge` 单事务回放并把台账置 `REVERTED`，旧编号立即重新生效。归并链只能按逆序拆（头上还有生效归并时报 `MERGE_CHAIN_BLOCKED`）。
5. **两台设备并发只允许一笔生效**：`mergeLock` 单例行 + 抢锁（带 15 秒租约，持锁页崩溃后可接管）。竞争方先在各自事务中读到锁，IndexDB 读写事务串行提交，只有第一笔能把锁从空闲推进为持有；后来者收到 `MERGE_LOCK_BUSY`，且**一笔引用都不改**。
6. **凭原请求编号恢复**：提交时先落一条 `FAILED` 台账（含快照与 `request_id`），抢锁失败或迁移失败都保留它。失败方用同一个 `request_id` 调 `recoverSymbolMerge` 即可续跑；相同请求编号重复提交幂等，复用于另一组卡片报 `MERGE_DUPLICATE_CONFLICT`。
7. **升级兼容原编号**：v1→v2 只新增 `symbolMerge`、`mergeLock` 两张表并补空闲锁行，旧业务数据原样保留；所有列表再经别名解析，所以旧数据升级后无需手工迁移。错题本（`services/mistakeBook`）和学习进度（`services/progress`）一律按保留卡片重算聚合。

IndexedDB 对象仓：`brailleSymbol`、`lesson`、`practiceSession`、`answerRecord`（索引 `by_symbol`、`by_session`）、`symbolMerge`（索引 `by_request` 唯一、`by_status`、`by_kept`、`by_merged`）、`mergeLock`（单例 key `symbol-merge`）。

## 项目目录结构

```text
frontend/src/
├── api/                  # 本地 IndexedDB 异步封装，按模型分文件（含 SymbolMerge）
├── idb/                  # 数据库升级、通用事务仓储、归并锁 CAS
├── services/             # 归并预览/提交/恢复/拆回、别名解析、错题本、进度重算
├── stores/               # Zustand 独立 store（含 SymbolMergeStore）
├── types/                # 数据模型类型定义（含 SymbolMerge、MergeStatus）
├── constants/            # 枚举、日志模板、错误码/错误信息、状态文案
├── constructors/         # 默认对象、台账行/快照/迁移结果构造器
├── components/common/    # BrailleCell / MergePanel / MergeLedger / MistakeBook / ProgressBoard 等
├── hooks/                # useBraillePattern / usePracticeSession / useIndexedDbStore / useSymbolMerge
├── pages/                # learn / practice / mistakes / progress / merge
├── router/
├── utils/                # formatters、三层异常类、日志、请求与设备编号
└── mocks/                # 首次建库种子数据（含两对重复卡片：1=7、3=8）
frontend/tests/symbolMerge.test.ts  # 预览/迁移/幂等/抢占恢复/快照拆回/链式阻塞/原子性
```

## 环境变量说明

- `COMPOSE_PROJECT_NAME`: Compose 项目名，默认 `braille-trainer`
- `FRONTEND_PORT`: 前端端口，默认 `20111`

## Docker 部署说明

- 根 Compose 文件不写 `version`，顶层 `name: braille-trainer`。
- 容器名均使用 `${COMPOSE_PROJECT_NAME:-braille-trainer}` 前缀。
- 本应用为纯前端、数据在浏览器 IndexedDB，无数据库命名卷；需要重置本地数据时在浏览器清除站点数据，或执行 `docker compose down` 后重建容器。
- 常见问题：端口占用时修改 `.env` 中端口后重启；需要重置应用数据时执行 `docker compose down -v`。

## 枚举/常量出现位置清单

- PracticeMode（CELL_TO_TEXT / TEXT_TO_CELL / LISTENING / MIXED）：
  `constants/PracticeMode.ts`（中文文案）、`types/PracticeMode.ts`（镜像类型）、`constants/statusText.ts`、`mocks/seedData.ts`、`constructors/PracticeSessionConstructor.ts`、`pages/PracticePage.tsx`。
- SymbolCategory（LETTER / NUMBER / PUNCTUATION / CONTRACTION）：
  `constants/SymbolCategory.ts`（中文文案）、`types/SymbolCategory.ts`（镜像类型）、`constants/statusText.ts`、`mocks/seedData.ts`、`constructors/BrailleSymbolConstructor.ts`、`pages/LearnPage.tsx`（筛选/展示）。
- MasteryLevel（NEW / LEARNING / FAMILIAR / MASTERED）：
  `constants/MasteryLevel.ts`、`types/MasteryLevel.ts`、`constants/statusText.ts`、`services/mistakeBook.ts`（重算）、`services/progress.ts`、`utils/formatters.ts`（formatMastery）、`components/common/MistakeBook.tsx`、`components/common/ProgressBoard.tsx`。
- MergeStatus（MERGED / REVERTED / FAILED）：
  `constants/MergeStatus.ts`（中文文案）、`types/MergeStatus.ts`（镜像类型）、`constants/statusText.ts`、`types/SymbolMerge.ts`、`constructors/SymbolMergeConstructor.ts`、`constants/logTemplates.ts`（5 条归并日志）、`constants/errorCodes.ts` + `constants/errorMessages.ts`（MERGE_* 错误族）、`services/symbolMerge.ts`、`idb`（`symbolMerge` 仓的 `by_status` 索引）、`components/common/StatusBadge.tsx`、`components/common/MergeLedger.tsx`、`utils/formatters.ts`。

## 错误处理分层

- service 层抛 `ServiceError`（`utils/errors.ts`，如 `MERGE_LOCK_BUSY`、`MERGE_CHAIN_BLOCKED`）。
- api 层包成 `ApiError`（`api/SymbolMerge.ts` 的 `callApi`，并保留原始错误码）。
- controller/hook 层再包成 `ControllerError`（`hooks/useSymbolMerge.ts`），页面只消费消息，禁止跨层吞异常。
- 所有写操作经 `utils/logger.ts` 按 `constants/logTemplates.ts` 记日志（预览、提交、失败恢复、快照拆回、抢占冲突）。

## 为什么会牵一发动全身

实体字段、枚举、日志模板、错误消息、构造器、筛选器和展示组件被刻意拆散到多个目录；一次字符归并改动会同时触达类型（SymbolMerge/MergeStatus）、常量（日志/错误/文案）、IDB 层（schema 升级、锁、事务）、service（预览/迁移/别名/错题/进度）、api、store、controller hook、页面、共享组件、测试与 README。

## License

MIT
