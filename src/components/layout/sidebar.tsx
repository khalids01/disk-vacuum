import { Link } from "@tanstack/react-router";
import {
  BotIcon,
  Code2Icon,
  CopyIcon,
  FilesIcon,
  FolderSearch2Icon,
  HardDriveIcon,
  type LucideIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  to?: "/overview";
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Explore",
    items: [
      { label: "Space Map", icon: HardDriveIcon, to: "/overview" as const },
    ],
  },
  {
    label: "Cleanup",
    items: [
      { label: "Cleanup Hub", icon: Trash2Icon },
      { label: "Large Files", icon: FilesIcon },
      { label: "Duplicates", icon: CopyIcon },
      { label: "Developer", icon: Code2Icon },
      { label: "AI Storage", icon: BotIcon },
      { label: "App Leftovers", icon: SparklesIcon },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Explorer", icon: FolderSearch2Icon },
      { label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <HardDriveIcon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">DiskVacuum</p>
          <p className="text-xs text-muted-foreground">Storage utility</p>
        </div>
      </div>

      <div className="space-y-5 overflow-y-auto px-3 py-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Scan target
          </p>
          <p className="mt-1 text-sm font-medium">No scan selected</p>
          <Button className="mt-3 w-full" size="sm" disabled>
            <HardDriveIcon data-icon="inline-start" />
            Scan Drive
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled>
              Home
            </Button>
            <Button variant="outline" size="sm" disabled>
              Folder
            </Button>
          </div>
        </div>

        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const content = (
                  <>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                    {!item.to && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </>
                );

                return item.to ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    activeProps={{
                      className: "bg-accent text-accent-foreground",
                    }}
                    className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.label}
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground/60",
                    )}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
