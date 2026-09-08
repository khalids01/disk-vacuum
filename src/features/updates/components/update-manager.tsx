import { useEffect } from "react";
import { UpdateDialog } from "@/features/updates/components/update-control";
import { useUpdateStore } from "@/features/updates/stores/update-store";

export function UpdateManager() {
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void checkForUpdate({ manual: false }),
      4_000,
    );
    return () => window.clearTimeout(timeout);
  }, [checkForUpdate]);

  return <UpdateDialog />;
}
