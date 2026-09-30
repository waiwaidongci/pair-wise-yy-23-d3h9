# 盲文点字学习训练器

纯前端盲文点字学习与练习工具，支持点阵字符卡片、听写练习、错题本和学习进度统计，数据存 IndexedDB。

## 快速启动

```bash
cp .env.example .env && docker compose up -d
```

## 访问地址或 CLI 示例

前端：<http://localhost:20111>



## 本地开发方式

- 前端：`cd frontend && npm install && npm run dev`



## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Material UI + Zustand + IndexedDB |
| 后端 | - |
| 数据库 | 本地模拟数据 |
| 部署 | Docker Compose |

## 项目目录结构

```text
frontend/src/api, stores, types, constants, constructors, components/common, hooks, pages, router, utils, mocks, db, errors, services
```

## 环境变量说明

- `COMPOSE_PROJECT_NAME`: Compose 项目名，默认 `braille-trainer`
- `FRONTEND_PORT`: 前端端口，默认 `20111`


## Docker 部署说明

- 根 Compose 文件不写 `version`，顶层 `name: braille-trainer`。
- 容器名均使用 `${COMPOSE_PROJECT_NAME:-braille-trainer}` 前缀。
- 数据库使用命名卷，避免绑定中文路径。
- 常见问题：端口占用时修改 `.env` 中端口后重启；需要重置数据时执行 `docker compose down -v`。

## 枚举/常量出现位置清单

- PracticeMode: constants/PracticeMode、types/PracticeMode、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- SymbolCategory: constants/SymbolCategory、types/SymbolCategory、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- MasteryLevel: constants/MasteryLevel、types/MasteryLevel、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- MergeStatus: constants/MergeStatus、types/BrailleSymbolMerge、constructors、logTemplates、errorMessages、MergePanel、mergeService 均有引用。

## 字符归并（BrailleSymbolMerge）

同一个点字字符建成两条卡片时，通过「字符归并」功能将待并入卡片的引用统一迁到保留卡片。

- 页面：`/merge`（`pages/MergePage.tsx`）
- 选保留卡片与待并入卡片后，先预览受影响的课程、练习会话和答题记录，再统一迁移。
- 旧编号保留来源：`symbolIdMapping` 表记录 `old_id → new_id`，归并后可用旧编号查到保留卡片。
- 误合拆回：归并前生成快照（`snapshot`），误合可按快照恢复卡片与全部引用。
- 并发控制：`db/database.ts` 使用版本号乐观锁（CAS），两台设备并发归并只有一笔生效；冲突后凭原请求编号（`request_id`）幂等恢复，不留下半套引用。
- 错题本与学习进度：归并后 `services/statsService.ts` 按保留卡片重算错题聚合与课程掌握度。

### 归并相关文件

| 层 | 文件 |
|---|---|
| 类型 | `types/BrailleSymbolMerge.ts` |
| 常量 | `constants/MergeStatus.ts`、`constants/logTemplates.ts`、`constants/errorCodes.ts`、`constants/errorMessages.ts` |
| 构造器 | `constructors/BrailleSymbolMergeConstructor.ts` |
| 错误 | `errors/MergeError.ts` |
| 数据库 | `db/database.ts`（乐观锁 + 事务 + 迁移） |
| 服务 | `services/mergeService.ts`、`services/statsService.ts` |
| API | `api/BrailleSymbolMerge.ts` |
| Store | `stores/BrailleSymbolMergeStore.ts` |
| Hook | `hooks/useBrailleMerge.ts`、`hooks/useDatabase.ts` |
| 组件 | `components/common/MergePanel.tsx`、`components/common/StatsPanel.tsx` |
| 页面 | `pages/MergePage.tsx` |

## 为什么会牵一发动全身

实体字段、枚举、日志模板、错误消息、构造器、筛选器和展示组件被刻意拆散到多个目录；修改一个状态值通常需要同步类型、构造器、服务、控制器、store、页面、README 与数据库种子。

## License

MIT
