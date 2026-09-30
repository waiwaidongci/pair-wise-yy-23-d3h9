export const formatDate = (value: string) => new Date(value).toLocaleString("zh-CN");
export const formatStatus = (value: string) => value.replace(/_/g, " ");
export const formatNumber = (value: number) => new Intl.NumberFormat("zh-CN").format(value);
export const formatRisk = (value: string) => ({ LOW: "低", MEDIUM: "中", HIGH: "高", CRITICAL: "严重", EXTREME: "极高" }[value] ?? value);

import { MergeStatusText as MergeStatusTextConst } from "../constants/MergeStatus";
import type { MergeStatusValue } from "../types/MergeStatus";
import type { MasteryLevel } from "../types/MasteryLevel";

/** 归并台账状态文案（错题本、学习进度、归并页共用） */
export const formatMergeStatus = (value: MergeStatusValue) => MergeStatusTextConst[value] ?? value;

/** 错题本按保留卡片重算的掌握程度 */
export const formatMastery = (value: MasteryLevel) =>
  ({ NEW: "未学", LEARNING: "学习中", FAMILIAR: "熟悉", MASTERED: "已掌握" })[value] ?? value;

/** 答题记录的布尔对错字段统一展示 */
export const formatCorrect = (value: boolean) => (value ? "答对" : "答错");

/** 归并旧编号来源：1 <- 7 */
export const formatMergeChain = (chains: { kept: number; merged: number }[]) =>
  chains.map(({ kept, merged }) => `${merged} → ${kept}`).join("，");

/** 0~1 的比率展示成百分比 */
export const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
