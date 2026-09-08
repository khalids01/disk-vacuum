import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AppSettings,
  type ScanTargetPreference,
  saveSettings,
} from "@/features/settings/api/settings-api";
import { settingsQuery } from "@/features/settings/api/settings-queries";
import { UpdateControl } from "@/features/updates/components/update-control";
import { type Theme, useThemeStore } from "@/stores/theme-store";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery(settingsQuery);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [draftThreshold, setDraftThreshold] = useState("100");
  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (settings) =>
      queryClient.setQueryData(settingsQuery.queryKey, settings),
  });
  const settings = query.data;
  useEffect(() => {
    if (settings) setDraftThreshold(String(settings.largeFileThresholdMb));
  }, [settings]);

  async function update(patch: Partial<AppSettings>) {
    if (!settings || mutation.isPending) return;
    await mutation.mutateAsync({ ...settings, ...patch });
  }
  async function addExclusion() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Exclude a folder from DiskVacuum",
    });
    if (
      typeof selected === "string" &&
      settings &&
      !settings.exclusions.includes(selected)
    ) {
      await update({ exclusions: [...settings.exclusions, selected] });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Control how DiskVacuum works"
        description="Preferences are saved locally. Excluded folders are skipped by future scans and blocked from cleanup."
      />
      {query.isPending && <Message>Loading settings…</Message>}
      {query.isError && <Message>Settings could not be loaded.</Message>}
      {settings && (
        <>
          <SettingsSection
            title="Appearance"
            description="Choose a fixed theme or continue following your operating system."
          >
            <Field label="Theme">
              <Select
                value={theme}
                onValueChange={(value) => value && setTheme(value as Theme)}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System default</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Scan preferences"
            description="These defaults shape discovery views; explicit Scan buttons still do exactly what they say."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Preferred scan target">
                <Select
                  value={settings.defaultScanTarget}
                  onValueChange={(value) =>
                    value &&
                    void update({
                      defaultScanTarget: value as ScanTargetPreference,
                    })
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
              </Field>
              <Field label="Default large-file threshold (MB)">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1048576}
                    value={draftThreshold}
                    onChange={(event) => setDraftThreshold(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      mutation.isPending ||
                      !Number.isFinite(Number(draftThreshold)) ||
                      Number(draftThreshold) < 1
                    }
                    onClick={() =>
                      void update({
                        largeFileThresholdMb: Math.round(
                          Number(draftThreshold),
                        ),
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Exclusions"
            description="Excluded folders disappear on the next scan. Existing saved results remain visible until you rescan."
          >
            <Button
              variant="outline"
              onClick={() => void addExclusion()}
              disabled={mutation.isPending}
            >
              <FolderPlusIcon data-icon="inline-start" />
              Add excluded folder
            </Button>
            {settings.exclusions.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                No folders are excluded.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-border rounded-lg border border-border">
                {settings.exclusions.map((path) => (
                  <div key={path} className="flex items-center gap-3 p-3">
                    <PathText className="min-w-0 flex-1">{path}</PathText>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove exclusion ${path}`}
                      disabled={mutation.isPending}
                      onClick={() =>
                        void update({
                          exclusions: settings.exclusions.filter(
                            (value) => value !== path,
                          ),
                        })
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Updates and onboarding"
            description="Check the signed release channel manually or replay the first-run guide."
          >
            <div className="flex flex-wrap gap-2">
              <UpdateControl />
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => void update({ onboardingComplete: false })}
              >
                Show onboarding again
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Safety and privacy"
            description="DiskVacuum analyzes storage locally and uses your operating system Trash for normal cleanup."
          >
            <div className="flex gap-3 rounded-lg bg-emerald-500/8 p-4 text-sm">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium">
                  Cleanup protections are always enabled
                </p>
                <p className="mt-1 text-muted-foreground">
                  Canonical paths, scan scope, protected system locations,
                  symbolic links, changed files, and your exclusions are checked
                  again before cleanup.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No scan index or file contents are uploaded by DiskVacuum. Linux
              permission-denied locations are counted in the scan summary. macOS
              may require Full Disk Access for a complete system scan.
            </p>
          </SettingsSection>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              Settings could not be saved: {String(mutation.error)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard className="p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </SectionCard>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </div>
  );
}
function Message({ children }: { children: React.ReactNode }) {
  return (
    <SectionCard className="p-8 text-center text-sm text-muted-foreground">
      {children}
    </SectionCard>
  );
}
