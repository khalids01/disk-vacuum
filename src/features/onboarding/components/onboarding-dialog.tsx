import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderSearchIcon,
  HardDriveIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ScanTargetPreference,
  saveSettings,
} from "@/features/settings/api/settings-api";
import { settingsQuery } from "@/features/settings/api/settings-queries";

const STEPS = ["Welcome", "Safety", "Permissions", "First scan"] as const;

export function OnboardingDialog() {
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTargetPreference>("system");
  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (value) =>
      queryClient.setQueryData(settingsQuery.queryKey, value),
  });
  const platform = navigator.userAgent.includes("Mac")
    ? "macOS"
    : navigator.userAgent.includes("Linux")
      ? "Linux"
      : "your operating system";
  if (!settings.data || settings.data.onboardingComplete || dismissed)
    return null;

  async function finish() {
    if (!settings.data) return;
    await mutation.mutateAsync({
      ...settings.data,
      onboardingComplete: true,
      defaultScanTarget: scanTarget,
    });
  }

  return (
    <Dialog open={!dismissed}>
      <DialogContent
        className="flex max-h-[min(90vh,720px)] flex-col overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border p-5">
          <div
            className="mb-3 flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={`Step  of `}
          >
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <DialogTitle>{STEPS[step]}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <Step icon={SparklesIcon} title="See what is using your storage">
              DiskVacuum scans locally, keeps a compact durable index, and helps
              you inspect large files, duplicates, developer artifacts, AI
              storage, and application leftovers.
            </Step>
          )}
          {step === 1 && (
            <Step
              icon={ShieldCheckIcon}
              title="Nothing disappears automatically"
            >
              Cleanup is review-first. Eligible items are revalidated against
              the saved scan, protected paths and exclusions are blocked, and
              normal cleanup moves items to your system Trash.
            </Step>
          )}
          {step === 2 && (
            <Step icon={FolderSearchIcon} title={`${platform} access`}>
              {platform === "macOS"
                ? "A Home or custom-folder scan works with normal access. A complete system scan may require Full Disk Access in System Settings → Privacy & Security → Full Disk Access. DiskVacuum continues safely when access is denied."
                : "DiskVacuum scans paths your user can read. Linux system scans may report permission-denied locations; those are counted and skipped without stopping the scan. You never need to run DiskVacuum as root."}
            </Step>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <Step
                icon={HardDriveIcon}
                title="Choose your primary scan action"
              >
                This choice only changes the prominent sidebar button. Home,
                System, and Folder scans always remain available.
              </Step>
              <div className="grid gap-2 text-sm font-medium">
                <span>Preferred scan target</span>
                <Select
                  value={scanTarget}
                  onValueChange={(value) =>
                    value && setScanTarget(value as ScanTargetPreference)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Whole system</SelectItem>
                    <SelectItem value="home">Home directory</SelectItem>
                    <SelectItem value="folder">Choose a folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {mutation.isError && (
            <p className="mt-4 text-sm text-destructive">
              DiskVacuum could not save onboarding. Please try again.
            </p>
          )}
        </div>
        <DialogFooter className="m-0 justify-between">
          <div>
            {step === 0 && (
              <Button variant="ghost" onClick={() => setDismissed(true)}>
                Skip for now
              </Button>
            )}
            {step > 0 && (
              <Button
                variant="ghost"
                onClick={() => setStep((value) => value - 1)}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Back
              </Button>
            )}
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((value) => value + 1)}>
              Continue
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button disabled={mutation.isPending} onClick={() => void finish()}>
              {mutation.isPending ? "Saving…" : "Start using DiskVacuum"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof SparklesIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
