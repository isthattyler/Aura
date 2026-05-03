import { useState } from "react";
import { Wrench, RotateCcw, RefreshCw, HardDrive, Sparkles, Zap } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import { CATEGORY_COLORS, formatBytes, type SystemStats, type RamCleanResult } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Task {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  command: string;
}

const TASKS: Task[] = [
  {
    id: "dns",
    name: "Flush DNS Cache",
    description: "Clear the DNS resolver cache to fix connectivity issues",
    icon: RotateCcw,
    command: "dns_flush",
  },
  {
    id: "spotlight",
    name: "Rebuild Spotlight Index",
    description: "Re-index all files on the system for faster searches",
    icon: Sparkles,
    command: "rebuild_spotlight",
  },
  {
    id: "permissions",
    name: "Repair Disk Permissions",
    description: "Restore default file permissions on system directories",
    icon: HardDrive,
    command: "repair_permissions",
  },
  {
    id: "periodic",
    name: "Run Daily Maintenance Scripts",
    description: "Execute system maintenance scripts (periodic daily/weekly/monthly)",
    icon: RefreshCw,
    command: "run_periodic",
  },
];

export default function Maintenance() {
  const { addToast, systemStats, setSystemStats } = useAppStore();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, "success" | "error">>({});
  const [ramRunning, setRamRunning] = useState(false);
  const [ramResult, setRamResult] = useState<"success" | "error" | null>(null);

  const color = CATEGORY_COLORS.maintenance;

  const completedCount = Object.keys(results).length;

  async function runTask(task: Task) {
    setRunning(task.id);
    try {
      // Tasks are run through the Rust backend via invoke
      // const result = await invoke("run_maintenance_task", { task: task.command });
      // Backend: placeholder — will be implemented when the Rust side is built
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setResults((prev) => ({ ...prev, [task.id]: "success" }));
      addToast({ type: "success", title: task.name, description: "Completed" });
    } catch (e) {
      setResults((prev) => ({ ...prev, [task.id]: "error" }));
      addToast({ type: "error", title: task.name, description: String(e) });
    } finally {
      setRunning(null);
    }
  }

  async function handleFreeRam() {
    setRamRunning(true);
    try {
      const result = await invoke<RamCleanResult>("free_up_ram");
      setRamResult("success");
      addToast({
        type: "success",
        title: "RAM Freed",
        description: result.bytesFreed > 0
          ? `Freed ${formatBytes(result.bytesFreed)} of RAM`
          : result.message,
      });
      const stats = await invoke<SystemStats>("get_system_stats");
      setSystemStats(stats);
    } catch (e) {
      setRamResult("error");
      addToast({ type: "error", title: "Failed to free RAM", description: String(e) });
    } finally {
      setRamRunning(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Wrench size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">System maintenance</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {completedCount > 0 ? `${completedCount}/${TASKS.length} completed` : "Ready"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-3">
          {/* Featured: Free Up RAM */}
          <Card accentColor={color}>
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}
              >
                <Zap size={15} style={{ color }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-text-primary">Free Up RAM</span>
                  {ramResult && (
                    <Badge variant={ramResult === "success" ? "success" : "danger"}>
                      {ramResult === "success" ? "Done" : "Failed"}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Clear inactive memory and file caches to reclaim RAM
                </p>
                {systemStats && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-text-muted">
                        {formatBytes(systemStats.ramUsedBytes)} used
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {formatBytes(systemStats.ramTotalBytes)} total
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((systemStats.ramUsedBytes / systemStats.ramTotalBytes) * 100)}%`,
                          backgroundColor: color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={ramRunning}
                onClick={handleFreeRam}
                disabled={ramRunning}
              >
                {ramResult === "success" ? "Re-run" : "Run"}
              </Button>
            </div>
          </Card>
          {TASKS.map((task) => {
            const Icon = task.icon;
            const taskResult = results[task.id];
            const isRunning = running === task.id;

            return (
              <Card key={task.id}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}20`, border: `1px solid ${color}30` }}
                  >
                    <Icon size={15} style={{ color }} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-text-primary">{task.name}</span>
                      {taskResult && (
                        <Badge variant={taskResult === "success" ? "success" : "danger"}>
                          {taskResult === "success" ? "Done" : "Failed"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">{task.description}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isRunning}
                    onClick={() => runTask(task)}
                    disabled={isRunning}
                  >
                    {taskResult === "success" ? "Re-run" : "Run"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-[11px] text-text-muted mt-8">
          Maintenance tasks run system utilities and may require administrator privileges. Results may vary by platform.
        </p>
      </div>
    </div>
  );
}
