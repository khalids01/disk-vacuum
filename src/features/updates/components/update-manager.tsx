import { useEffect } from "react";
import { UpdateDialog } from "@/features/updates/components/update-control";
import { useUpdateStore } from "@/features/updates/stores/update-store";
import { isAndroid } from "@/lib/platform";

export function UpdateManager() {
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);

  useEffect(() => {
    if (isAndroid) return;
    const timeout = window.setTimeout(
      () => void checkForUpdate({ manual: false }),
      4_000,
    );
    return () => window.clearTimeout(timeout);
  }, [checkForUpdate]);

  if (isAndroid) return null;
  return <UpdateDialog />;
}
