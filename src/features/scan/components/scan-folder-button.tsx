import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { scanDirectoryPath } from "@/features/scan/api/scan-api";
import { useScanMutation } from "@/features/scan/hooks/use-scan-mutation";
import { useScanStore } from "@/stores/scan-store";

interface ScanFolderButtonProps
  extends Pick<
    ComponentProps<typeof Button>,
    "className" | "size" | "variant"
  > {
  children?: string;
}

export function ScanFolderButton({
  children = "Choose Folder",
  ...buttonProps
}: ScanFolderButtonProps) {
  const status = useScanStore((state) => state.status);
  const failScan = useScanStore((state) => state.failScan);
  const scanFolder = useScanMutation(scanDirectoryPath);
  const isScanActive =
    status === "scanning" || status === "cancelling" || scanFolder.isPending;

  async function chooseFolder() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Choose a folder to scan",
      });

      if (typeof selectedPath === "string") {
        scanFolder.mutate(selectedPath);
      }
    } catch {
      failScan("DiskVacuum could not open the folder picker.");
    }
  }

  return (
    <Button {...buttonProps} disabled={isScanActive} onClick={chooseFolder}>
      <FolderOpenIcon data-icon="inline-start" />
      {children}
    </Button>
  );
}
