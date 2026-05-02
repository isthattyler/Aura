import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Rocket, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useAppStore } from "@/store";
import { type StartupItem, CATEGORY_COLORS } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";

export default function StartupManager() {
  const { addToast } = useAppStore();
  const [items, setItems] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const color = CATEGORY_COLORS.startup;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<StartupItem[]>("list_startup_items");
      setItems(result);
      setLoaded(true);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load startup items", description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [addToast])

  async function toggleItem(id: string, path: string, current: boolean) {
    setToggling(id);
    try {
      await invoke("toggle_startup_item", { id, path, enabled: !current });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !current } : i)));
    } catch (e) {
      addToast({ type: "error", title: "Failed to toggle", description: String(e) });
    } finally {
      setToggling(null);
    }
  }

  async function removeItem(id: string) {
    try {
      await invoke("remove_startup_item", { id });
      setItems((prev) => prev.filter((i) => i.id !== id));
      addToast({ type: "success", title: "Removed startup item" });
    } catch (e) {
      addToast({ type: "error", title: "Failed to remove", description: String(e) });
    }
  }

  useEffect(() => { loadItems(); }, [loadItems]);

  const enabledItems = items.filter((i) => i.enabled);
  const disabledItems = items.filter((i) => !i.enabled);

  return (
    <div className="flex flex-col h-full">
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
              {loaded ? `${enabledItems.length} enabled · ${disabledItems.length} disabled` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {loaded && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <Rocket size={28} className="text-text-muted opacity-40" />
            <p className="text-[13px] font-medium text-text-primary">No startup items found</p>
          </div>
        )}

        {loaded && (
          <div className="space-y-4 max-w-xl">
            {enabledItems.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Enabled</div>
                <div className="space-y-2">
                  {enabledItems.map((item) => (
                    <StartupRow key={item.id} item={item} toggling={toggling} onToggle={toggleItem} onRemove={removeItem} />
                  ))}
                </div>
              </div>
            )}

            {disabledItems.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Disabled</div>
                <div className="space-y-2">
                  {disabledItems.map((item) => (
                    <StartupRow key={item.id} item={item} toggling={toggling} onToggle={toggleItem} onRemove={removeItem} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StartupRow({
  item,
  toggling,
  onToggle,
  onRemove,
}: {
  item: StartupItem;
  toggling: string | null;
  onToggle: (id: string, path: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-text-primary">{item.name}</span>
            <Badge variant={item.enabled ? "success" : "muted"}>
              {item.type.replace(/_/g, " ")}
            </Badge>
          </div>
          {item.path && (
            <div className="text-[11px] font-mono text-text-muted truncate mt-0.5">{item.path}</div>
          )}
          {item.publisher && (
            <div className="text-[10px] text-text-muted mt-0.5">{item.publisher}</div>
          )}
        </div>
        <button
          onClick={() => onToggle(item.id, item.path, item.enabled)}
          disabled={toggling === item.id}
          className="text-text-muted hover:text-accent transition-colors disabled:opacity-50"
          title={item.enabled ? "Disable" : "Enable"}
        >
          {item.enabled ? <ToggleRight size={20} className="text-accent" /> : <ToggleLeft size={20} />}
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="text-text-muted hover:text-danger transition-colors"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </Card>
  );
}
