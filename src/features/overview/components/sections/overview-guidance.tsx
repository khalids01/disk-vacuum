import { ArrowRightIcon, FolderSearch2Icon, Trash2Icon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";

const steps = [
  {
    icon: FolderSearch2Icon,
    title: "See what is using space",
    description:
      "Explore a visual space map and inspect the directories that matter most.",
  },
  {
    icon: Trash2Icon,
    title: "Review cleanup candidates",
    description:
      "Caches and artifacts are separated from personal files, with clear safety status.",
  },
];

export function OverviewGuidance() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {steps.map((step, index) => (
        <SectionCard key={step.title} className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary">
              <step.icon className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Step {index + 1}
              </p>
              <h2 className="mt-1 text-sm font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {step.description}
              </p>
            </div>
            <ArrowRightIcon className="ml-auto mt-1 size-4 text-muted-foreground" />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
