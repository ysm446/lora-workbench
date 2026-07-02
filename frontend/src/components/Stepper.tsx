import type { StepKey } from "../mock";

interface Props {
  steps: { key: StepKey; label: string }[];
  current: StepKey;
  onSelect: (s: StepKey) => void;
}

export function Stepper({ steps, current, onSelect }: Props) {
  return (
    <nav className="stepper">
      {steps.map((s, i) => (
        <div key={s.key} className="step-wrap">
          {i > 0 && <span className="step-sep">▸</span>}
          <button
            className={"step" + (s.key === current ? " current" : "")}
            onClick={() => onSelect(s.key)}
          >
            <span className="step-idx">{i + 1}</span>
            {s.label}
          </button>
        </div>
      ))}
    </nav>
  );
}
