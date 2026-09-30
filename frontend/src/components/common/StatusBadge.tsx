import { MergeStatusText } from "../../constants/MergeStatus";

const EXTRA_TEXT: Record<string, string> = {
  MERGED: MergeStatusText.MERGED,
  REVERTED: MergeStatusText.REVERTED,
  FAILED: MergeStatusText.FAILED,
  ANSWER_CORRECT: "答对",
  ANSWER_WRONG: "答错",
  LOCAL_DATA: "本地数据",
  READY: "就绪"
};

export function StatusBadge({ value }: { value: string }) {
  const label = EXTRA_TEXT[value] ?? String(value).replace(/_/g, " ");
  return <span className={"badge " + String(value).toLowerCase().replace(/_/g, "-")}>{label}</span>;
}
