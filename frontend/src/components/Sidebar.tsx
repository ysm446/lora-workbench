import type { Project } from "../mock";

interface Props {
  projects: Project[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function Sidebar({ projects, activeId, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">WORKSPACE</div>
      <div className="sidebar-sub">LoRA プロジェクト</div>
      <ul className="proj-list">
        {projects.map((p) => (
          <li
            key={p.id}
            className={"proj" + (p.id === activeId ? " active" : "")}
            onClick={() => onSelect(p.id)}
          >
            <div className="proj-name">{p.name}</div>
            <div className="proj-meta">
              <span className={"badge s-" + p.status}>{p.status}</span>
              <span className="proj-count">{p.images.length}枚</span>
            </div>
          </li>
        ))}
      </ul>
      <button className="new-proj">＋ 新規 LoRA</button>
    </aside>
  );
}
