import type { Project, StepKey } from "../mock";

const NOTES: Record<string, string> = {
  import: "raw 画像をドロップ → phash 重複除去 → 解像度／bucket 前提チェック",
  build:
    "repeats を設定 → train/{repeats}_{concept}/ を構築し .txt を書き出し",
  train:
    "kohya を subprocess 起動 → ログ SSE → epoch ごとに LoRA ＋ サンプル",
  test:
    "Forge で固定プロンプト × epoch × weight × 固定 seed のグリッド生成",
};

export function Placeholder({
  step,
  project,
}: {
  step: StepKey;
  project: Project;
}) {
  return (
    <div className="placeholder">
      <div className="ph-box">
        <div className="ph-step">{step.toUpperCase()}</div>
        <div className="ph-proj">{project.name}</div>
        <p className="ph-note">{NOTES[step] ?? "（この画面は今後実装）"}</p>
        {step === "import" && (
          <div className="drop-zone">ここに画像をドロップ</div>
        )}
      </div>
    </div>
  );
}
