import { useState } from "react";
import { PROJECTS, STEPS, type StepKey } from "./mock";
import { Sidebar } from "./components/Sidebar";
import { Stepper } from "./components/Stepper";
import { TagCurate } from "./components/TagCurate";
import { Placeholder } from "./components/Placeholder";

export function App() {
  const [activeProjectId, setActiveProjectId] = useState(PROJECTS[0].id);
  const [step, setStep] = useState<StepKey>("tag");

  const project = PROJECTS.find((p) => p.id === activeProjectId)!;

  return (
    <div className="app">
      <Sidebar
        projects={PROJECTS}
        activeId={activeProjectId}
        onSelect={setActiveProjectId}
      />
      <main className="main">
        <Stepper steps={STEPS} current={step} onSelect={setStep} />
        <div className="content">
          {step === "tag" || step === "curate" ? (
            <TagCurate key={project.id} project={project} mode={step} />
          ) : (
            <Placeholder step={step} project={project} />
          )}
        </div>
      </main>
    </div>
  );
}
