import { useQuery } from "@tanstack/react-query";
import {
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  RefreshCwIcon,
  ServerIcon,
} from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { systemInfoQuery } from "@/features/system/api/system-info-query";

const byteFormatter = new Intl.NumberFormat(undefined, {
  style: "unit",
  unit: "gigabyte",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
});

function formatBytes(bytes: number) {
  return byteFormatter.format(bytes / 1_000_000_000);
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h`;
}

export function SystemInfoSection() {
  const query = useQuery(systemInfoQuery);

  if (query.isPending) {
    return (
      <SectionCard className="flex min-h-64 items-center justify-center p-6">
        <div className="text-center">
          <RefreshCwIcon className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">Reading system information</p>
          <p className="mt-1 text-sm text-muted-foreground">
            DiskVacuum is asking this device for its current storage details.
          </p>
        </div>
      </SectionCard>
    );
  }

  if (query.isError) {
    return (
      <SectionCard className="p-5">
        <p className="text-sm font-semibold">
          System information is unavailable
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {query.error instanceof Error
            ? query.error.message
            : "The native system query did not return a response."}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </SectionCard>
    );
  }

  const info = query.data;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SystemMetric
          icon={ServerIcon}
          label="Operating system"
          value={info.osVersion ?? info.operatingSystem}
          detail={info.hostname ?? info.operatingSystem}
        />
        <SystemMetric
          icon={CpuIcon}
          label="CPU"
          value={`${info.cpuCount} logical cores`}
          detail={`Uptime ${formatUptime(info.uptimeSeconds)}`}
        />
        <SystemMetric
          icon={MemoryStickIcon}
          label="Memory available"
          value={formatBytes(info.availableMemoryBytes)}
          detail={`${formatBytes(info.totalMemoryBytes)} total`}
        />
        <SystemMetric
          icon={HardDriveIcon}
          label="Mounted volumes"
          value={String(info.volumes.length)}
          detail="Reported by this device"
        />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Volumes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Capacity and free space from the operating system.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh system information"
            onClick={() => query.refetch()}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        </div>
        {info.volumes.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No mounted volumes were reported by this device.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {info.volumes.map((volume) => {
              const usedSpace = Math.max(
                0,
                volume.totalSpaceBytes - volume.availableSpaceBytes,
              );
              const usedPercent =
                volume.totalSpaceBytes > 0
                  ? Math.round((usedSpace / volume.totalSpaceBytes) * 100)
                  : 0;

              return (
                <div
                  key={`${volume.mountPoint}-${volume.name}`}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-medium">
                        {volume.name}
                      </p>
                      {volume.isRemovable && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          Removable
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {volume.mountPoint} · {volume.fileSystem}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-medium">
                      {formatBytes(volume.availableSpaceBytes)} free
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(usedSpace)} used · {usedPercent}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

interface SystemMetricProps {
  icon: typeof ServerIcon;
  label: string;
  value: string;
  detail: string;
}

function SystemMetric({ icon: Icon, label, value, detail }: SystemMetricProps) {
  return (
    <SectionCard className="p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-4 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </SectionCard>
  );
}
