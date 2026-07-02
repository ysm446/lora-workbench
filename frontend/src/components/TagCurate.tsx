import { useState } from "react";
import type { Project, StepKey } from "../mock";

interface Props {
  project: Project;
  mode: StepKey; // "tag" | "curate"
}

export function TagCurate({ project, mode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<number>(-1);

  // プロジェクト切替時は App 側の key で再マウントされ選択がリセットされる
  const imgs = project.images;

  function clickImage(index: number, e: React.MouseEvent) {
    const id = imgs[index].id;
    const next = new Set(selected);
    if (e.shiftKey && lastClicked >= 0) {
      const [a, b] = [lastClicked, index].sort((x, y) => x - y);
      for (let i = a; i <= b; i++) next.add(imgs[i].id);
    } else if (e.ctrlKey || e.metaKey) {
      next.has(id) ? next.delete(id) : next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    setSelected(next);
    setLastClicked(index);
  }

  const selectedImgs = imgs.filter((i) => selected.has(i.id));
  const single = selectedImgs.length === 1 ? selectedImgs[0] : null;
  const commonTags =
    selectedImgs.length > 0
      ? selectedImgs
          .map((i) => new Set(i.tags))
          .reduce((acc, s) => new Set([...acc].filter((t) => s.has(t))))
      : new Set<string>();

  return (
    <div className="tagcurate">
      <div className="tc-toolbar">
        <span className="tc-title">
          {mode === "curate" ? "Curate（剪定）" : "Tag"} — {project.name}
        </span>
        <span className="tc-legend">
          <i className="lg cand" /> 剪定候補
          <i className="lg bl" /> ブラックリスト
          <i className="lg drop" /> keep off
        </span>
        <span className="tc-count">
          {imgs.length}枚 / 選択 {selected.size}
        </span>
      </div>

      <div className="grid">
        {imgs.map((img, i) => (
          <button
            key={img.id}
            className={
              "cell" +
              (selected.has(img.id) ? " sel" : "") +
              (img.keep ? "" : " dropped")
            }
            onClick={(e) => clickImage(i, e)}
            title={img.name}
          >
            <div
              className="thumb"
              style={{
                background: `linear-gradient(135deg, hsl(${img.hue} 60% 55%), hsl(${
                  (img.hue + 40) % 360
                } 60% 40%))`,
              }}
            >
              {img.candidate && <span className="tag-flag cand">候補</span>}
              {img.blacklisted && <span className="tag-flag bl">BL</span>}
            </div>
            <div className="cell-name">{img.name}</div>
          </button>
        ))}
      </div>

      <div className="tagbar">
        {selectedImgs.length === 0 ? (
          <span className="tb-empty">
            画像を選択（Ctrl / Shift で複数選択）→ タグを一括編集
          </span>
        ) : (
          <>
            <div className="tb-left">
              <div className="tb-line">
                <span className="tb-label">トリガー</span>
                <span className="chip trigger">{project.trigger}</span>
                {single ? (
                  <span className="tb-sub">{single.name}</span>
                ) : (
                  <span className="tb-sub">{selectedImgs.length} 枚を選択中（共通タグ）</span>
                )}
              </div>
              <div className="tb-line tags">
                {[...(single ? single.tags : commonTags)].map((t) => (
                  <span key={t} className="chip">
                    {t} <b>×</b>
                  </span>
                ))}
                <span className="chip add">＋ タグ追加</span>
              </div>
            </div>
            <div className="tb-actions">
              <button>WD14 再タグ</button>
              <button className="primary">LLM 剪定</button>
              <button>keep 切替</button>
              <button className="save">保存</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
