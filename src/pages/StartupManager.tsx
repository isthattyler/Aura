import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Rocket, ToggleLeft, ToggleRight, Trash2, Lock, ShieldOff } from "lucide-react";
import { useAppStore } from "@/store";
import { type StartupItem, type StartupType, CATEGORY_COLORS } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import PermissionDialog from "@/components/PermissionDialog";

const FDA_PROMPTED_KEY = "aura-startup-fda-prompted";

const TYPE_LABELS: Record<string, string> = {
  launchd_agent: "Launch Agent",
  launchd_daemon: "Launch Daemon",
  btm_app: "Background Task",
  btm_daemon: "Background Daemon",
  btm_developer: "Developer Tool",
  registry_run: "Registry Run",
  scheduled_task: "Scheduled Task",
  systemd_user: "systemd Unit",
  xdg_autostart: "Autostart Entry",
};

function isBtm(type: StartupType): boolean {
  return type === "btm_app" || type === "btm_daemon" || type === "btm_developer";
}

function isProtectedItem(path: string): boolean {
  return path.startsWith("__system__");
}

function displayPath(path: string): string {
  return path.replace(/^__system__/, "/System/Library/");
}

function displayType(type: StartupType): string {
  return TYPE_LABELS[type] ?? type;
}

export default function StartupManager() {
  const { addToast } = useAppStore();
  const [items, setItems] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [hasFda, setHasFda] = useState<boolean | null>(null);
  const [showPermission, setShowPermission] = useState(false);
  const [showSystemItems, setShowSystemItems] = useState(false);

  const color = CATEGORY_COLORS.startup;

  const loadItems = useCallback(
    async (includeSystem: boolean) => {
      setLoading(true);
      try {
        const [result, fda] = await Promise.all([
          invoke<StartupItem[]>("list_startup_items", {
            includeSystem,
            includeBtm: includeSystem,
          }),
          invoke<boolean>("check_permission").catch(() => null as boolean | null),
        ]);
        setItems(result);
        setLoaded(true);
        setHasFda(fda);
      } catch (e) {
        addToast({ type: "error", title: "Failed to load startup items", description: String(e) });
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  // Load user-only items on mount (no prompts)
  useEffect(
    () => {
      void loadItems(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // One-time FDA prompt: show PermissionDialog on first visit if FDA not granted
  useEffect(() => {
    if (hasFda === false && !localStorage.getItem(FDA_PROMPTED_KEY)) {
      setShowPermission(true);
      localStorage.setItem(FDA_PROMPTED_KEY, "true");
    }
  }, [hasFda]);

  async function handleToggleSystem() {
    const next = !showSystemItems;
    setShowSystemItems(next);
    if (next) {
      await loadItems(true);
    } else {
      await loadItems(false);
    }
  }

  async function handleRetry() {
    setShowPermission(false);
    await loadItems(showSystemItems);
  }

  async function toggleItem(item: StartupItem) {
    if (isProtectedItem(item.path)) {
      addToast({ type: "warning", title: "Protected", description: "System startup items cannot be modified" });
      return;
    }
    if (isBtm(item.type)) {
      addToast({ type: "info", title: "System Settings", description: "Background Task items must be managed in System Settings" });
      return;
    }

    setToggling(item.id);
    try {
      const actualPath = displayPath(item.path);
      await invoke("toggle_startup_item", { id: item.id, path: actualPath, enabled: !item.enabled });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, enabled: !item.enabled } : i)));
    } catch (e) {
      addToast({ type: "error", title: "Failed to toggle", description: String(e) });
    } finally {
      setToggling(null);
    }
  }

  async function removeItem(item: StartupItem) {
    if (isProtectedItem(item.path)) return;
    if (isBtm(item.type)) {
      addToast({ type: "info", title: "System Settings", description: "Background Task items must be managed in System Settings" });
      return;
    }

    setRemoving(item.id);
    try {
      const actualPath = displayPath(item.path);
      await invoke("remove_startup_item", { id: item.id, path: actualPath });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast({ type: "success", title: "Removed startup item" });
    } catch (e) {
      addToast({ type: "error", title: "Failed to remove", description: String(e) });
    } finally {
      setRemoving(null);
    }
  }

  // Group items
  const groups: Record<string, StartupItem[]> = {};
  for (const item of items) {
    const grp = isProtectedItem(item.path) ? "System Services" : displayType(item.type);
    (groups[grp] ??= []).push(item);
  }

  const groupOrder = [
    "Background Task",
    "Background Daemon",
    "Developer Tool",
    "Launch Agent",
    "Launch Daemon",
    "System Services",
  ];

  const systemItemCount = items.filter((i) => isProtectedItem(i.path)).length;

  return (
    <div className="flex flex-col h-full">
      {showPermission && (
        <PermissionDialog
          onRetry={handleRetry}
          onDismiss={() => setShowPermission(false)}
        />
      )}

      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Rocket size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">Startup items</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {loaded ? `${items.length} found` : "—"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSystemItems}
                onChange={() => void handleToggleSystem()}
                className="w-3.5 h-3.5 accent-[#00D4AA] cursor-pointer"
              />
              Show system services
            </label>
            <button
              onClick={() => void handleToggleSystem()}
              className="text-[11px] text-accent hover:text-accent-hover transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* FDA Banner — only show after one-time prompt if FDA still not granted */}
        {loaded && hasFda === false && localStorage.getItem(FDA_PROMPTED_KEY) && (
          <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-warning/10 border border-warning/20 rounded-xl">
            <ShieldOff size={16} className="text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-warning">
                Full Disk Access not granted
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {systemItemCount > 0
                  ? "Some system services are hidden"
                  : "Enable to see system startup items"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowPermission(true)}>
              Open Settings
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {loaded && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <Rocket size={28} className="text-text-muted opacity-40" />
            <p className="text-[13px] font-medium text-text-primary">No startup items found</p>
            <p className="text-[12px] text-text-muted max-w-xs">
              {showSystemItems
                ? "Login items, LaunchAgents, LaunchDaemons, and background tasks will appear here"
                : "Check \"Show system services\" to include system daemons"}
            </p>
          </div>
        )}

        {loaded && items.length > 0 && (
          <div className="space-y-6 max-w-xl">
            {groupOrder.map((groupName) => {
              const groupItems = groups[groupName];
              if (!groupItems || groupItems.length === 0) return null;
              const isSystem = groupName === "System Services";

              return (
                <div key={groupName}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2 flex items-center gap-2">
                    {isSystem && <Lock size={10} className="text-warning" />}
                    {groupName}
                    <span className="text-text-muted opacity-60">({groupItems.length})</span>
                  </div>
                  <div className="space-y-2">
                    {groupItems.map((item) => (
                      <StartupRow
                        key={item.id}
                        item={item}
                        isProtected={isProtectedItem(item.path)}
                        toggling={toggling === item.id}
                        removing={removing === item.id}
                        onToggle={() => toggleItem(item)}
                        onRemove={() => removeItem(item)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Fallback for any groups not in the ordered list */}
            {Object.entries(groups).map(([groupName, groupItems]) => {
              if (groupOrder.includes(groupName)) return null;
              return (
                <div key={groupName}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
                    {groupName} ({groupItems.length})
                  </div>
                  <div className="space-y-2">
                    {groupItems.map((item) => (
                      <StartupRow
                        key={item.id}
                        item={item}
                        isProtected={isProtectedItem(item.path)}
                        toggling={toggling === item.id}
                        removing={removing === item.id}
                        onToggle={() => toggleItem(item)}
                        onRemove={() => removeItem(item)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StartupRow({
  item,
  isProtected,
  toggling,
  removing,
  onToggle,
  onRemove,
}: {
  item: StartupItem;
  isProtected: boolean;
  toggling: boolean;
  removing: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isBtmItem = isBtm(item.type);
  const path = displayPath(item.path);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-medium text-text-primary">{item.name}</span>
            <Badge variant={item.enabled ? "success" : "muted"}>
              {displayType(item.type)}
            </Badge>
            {item.enabled && <Badge variant="info">active</Badge>}
            {!item.enabled && <Badge variant="muted">disabled</Badge>}
          </div>
          {path && (
            <div className="text-[11px] font-mono text-text-muted truncate mt-0.5">{path}</div>
          )}
          {(item.publisher || item.description) && (
            <div className="text-[10px] text-text-muted mt-0.5 flex gap-2">
              {item.publisher && <span>{item.publisher}</span>}
              {item.description && <span className="text-text-muted/60">{item.description}</span>}
            </div>
          )}
        </div>

        {isProtected ? (
          <span title="System item — cannot modify">
            <Lock size={14} className="text-warning shrink-0" />
          </span>
        ) : isBtmItem ? (
          <span className="text-[10px] text-text-muted shrink-0">System Settings</span>
        ) : (
          <>
            <button
              onClick={onToggle}
              disabled={toggling}
              className="text-text-muted hover:text-accent transition-colors disabled:opacity-50 shrink-0"
              title={item.enabled ? "Disable" : "Enable"}
            >
              {item.enabled ? <ToggleRight size={20} className="text-accent" /> : <ToggleLeft size={20} />}
            </button>
            <button
              onClick={onRemove}
              disabled={removing}
              className="text-text-muted hover:text-danger transition-colors disabled:opacity-50 shrink-0"
              title="Remove"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
