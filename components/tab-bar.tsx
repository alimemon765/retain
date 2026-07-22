import Link from "next/link";

export interface TabDef {
  key: string;
  label: string;
}

/**
 * Horizontal, scrollable sub-tab bar for Progress and Library. Tabs are driven
 * by the `?tab=` search param so each tab is a server render that loads only
 * its own data — keeps heavy analytics off the initial paint.
 */
export function TabBar({
  basePath,
  tabs,
  active,
}: {
  basePath: string;
  tabs: TabDef[];
  active: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-1 rounded-lg border border-edge bg-surface p-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={`${basePath}?tab=${t.key}`}
              scroll={false}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                isActive
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
