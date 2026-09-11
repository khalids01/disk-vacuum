import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type CleanupResult,
  type CleanupTarget,
  permanentlyDeleteCleanupFiles,
  previewCleanupTargets,
} from "@/features/cleanup/api/cleanup-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";

export function PermanentDeleteDialog({
  items,
  onComplete,
}: {
  items: CleanupTarget[];
  onComplete: (result: CleanupResult) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const preview = useMutation({
    mutationFn: () => previewCleanupTargets(items),
  });
  const cleanup = useMutation({
    mutationFn: () => permanentlyDeleteCleanupFiles(items),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["current-scan"] });
      onComplete(result);
    },
  });
  const ready = preview.data?.ready ?? [];
  const rejected = preview.data?.rejected ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setConfirmation("");
          cleanup.reset();
          preview.mutate();
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        Delete all permanently…
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Permanently delete all selected items?</DialogTitle>
          <DialogDescription>
            This deletes the validated files and directories immediately, bypasses Trash, and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>
              {preview.isPending
                ? "Validating every selected file…"
                : `${ready.length.toLocaleString()} items · ${formatBytes(preview.data?.reclaimableSizeBytes ?? 0)}`}
            </p>
          </div>
          {rejected.length > 0 && (
            <p className="text-sm text-destructive">
              {rejected.length.toLocaleString()} items failed validation and will be skipped. Valid items can still be deleted.
            </p>
          )}
          {(preview.error || cleanup.error) && (
            <p className="text-sm text-destructive">
              {String(preview.error ?? cleanup.error)}
            </p>
          )}
          <label
            htmlFor="permanent-delete-confirmation"
            className="grid gap-2 text-sm font-medium"
          >
            Type DELETE to confirm
            <Input
              id="permanent-delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={
              !preview.data ||
              !ready.length ||
              confirmation !== "DELETE" ||
              cleanup.isPending
            }
            onClick={() => cleanup.mutate()}
          >
            {cleanup.isPending && <LoaderCircleIcon className="animate-spin" />}
            Delete all permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
