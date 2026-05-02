import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, ChevronRight, Folder, File } from "lucide-react";
import { useAppStore } from "@/store";
import { type Volume, type DiskNode, formatBytes } from "@/types";
import { Card, ProgressBar } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = ["#00D4AA", "#60A5FA", "#8B5CF6", "#F59E0B", "#EC4899", "#EF4444", "#10B981", "#F97316"];

interface TreeData {
  name: string;
  size: number;
  color: string;
  children?: TreeData[];
  path?: string;
}

export default function DiskSpace() {
  const { addToast } = useAppStore();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>("");
  const [tree, setTree] = useState<DiskNode | null>(null);
  const [path, setPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const color = "#06B6D4";

  useEffect(() => {
    invoke<Volume[]>("get_volumes")
      .then((v) => {
        setVolumes(v);
        if (v.length > 0) {
          setSelectedVolume(v[0].mountPoint);
          setPath(v[0].mountPoint);
        }
      })
      .catch(() => {});
  }, []);

  async function loadTree(p: string) {
    setLoading(true);
    try {
      const node = await invoke<DiskNode>("get_disk_usage", { path: p, depth: 2 });
      setTree(node);
      setLoaded(true);
      setPath(p);
    } catch (e) {
      addToast({ type: "error", title: "Failed to load disk usage", description: String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedVolume) loadTree(selectedVolume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVolume]);

  function convertToTreeData(node: DiskNode, depth = 0): TreeData {
    const color = COLORS[depth % COLORS.length];
    if (node.children && node.children.length > 0) {
      return {
        name: node.name,
        size: node.sizeBytes,
        color,
        path: node.path,
        children: node.children.map((c) => convertToTreeData(c, depth + 1)),
      };
    }
    return { name: node.name, size: node.sizeBytes, color, path: node.path };
  }

  function formatSizeForTree(bytes: number): string {
    return formatBytes(bytes);
  }

  const currentVolume = volumes.find((v) => v.mountPoint === selectedVolume);
  const treeData = tree ? [convertToTreeData(tree)] : [];
  const pathParts = path.split("/").filter(Boolean);

  function navigateToSubdir(childPath: string) {
    loadTree(childPath);
  }

  function navigateToVolume(mp: string) {
    setSelectedVolume(mp);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <HardDrive size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">Disk usage</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {currentVolume ? `${formatBytes(currentVolume.usedBytes)} / ${formatBytes(currentVolume.totalBytes)}` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Volume selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {volumes.map((v) => (
            <button
              key={v.mountPoint}
              onClick={() => navigateToVolume(v.mountPoint)}
              className={`px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                selectedVolume === v.mountPoint
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "text-text-secondary hover:text-text-primary bg-bg-surface border border-border-subtle"
              }`}
            >
              <span className="font-medium">{v.name || v.mountPoint}</span>
              <span className="ml-1.5 font-mono opacity-70">{Math.round((v.usedBytes / v.totalBytes) * 100)}%</span>
            </button>
          ))}
        </div>

        {/* Volume info */}
        {currentVolume && (
          <Card className="mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[11px] text-text-muted mb-1">
                  {currentVolume.name || currentVolume.mountPoint} · {currentVolume.fileSystem}
                </div>
                <ProgressBar value={(currentVolume.usedBytes / currentVolume.totalBytes) * 100} />
                <div className="flex justify-between mt-1 text-[10px] font-mono text-text-muted">
                  <span>{formatBytes(currentVolume.usedBytes)} used</span>
                  <span>{formatBytes(currentVolume.freeBytes)} free</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Breadcrumb */}
        {loaded && tree && (
          <div className="flex items-center gap-1 mb-4 text-[11px]">
            <button onClick={() => loadTree(selectedVolume)} className="text-accent hover:text-accent-hover transition-colors">
              {currentVolume?.name || "root"}
            </button>
            {pathParts.slice(1).map((part, i) => {
              const fullPath = "/" + pathParts.slice(0, i + 2).join("/");
              return (
                <span key={fullPath} className="flex items-center gap-1">
                  <ChevronRight size={10} className="text-text-muted" />
                  <button
                    onClick={() => loadTree(fullPath)}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {/* Treemap */}
        {loaded && treeData[0] && (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
            <ResponsiveContainer width="100%" height={400}>
              <Treemap
                data={treeData[0].children ?? []}
                dataKey="size"
                nameKey="name"
                stroke="var(--color-bg-base)"
                fill="#8884d8"
                content={<CustomizedContent />}
              >
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => formatSizeForTree(value)}
                  labelFormatter={(name: string) => name}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}

        {/* Directory listing */}
        {loaded && tree && tree.children && tree.children.length > 0 && (
          <div className="mt-4 space-y-1">
            {tree.children.map((child) => (
              <div
                key={child.path}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-elevated cursor-pointer transition-colors"
                onClick={() => child.isDirectory && navigateToSubdir(child.path)}
              >
                {child.isDirectory ? (
                  <Folder size={13} className="text-text-muted" />
                ) : (
                  <File size={13} className="text-text-muted" />
                )}
                <span className="flex-1 text-[12px] text-text-primary truncate">{child.name}</span>
                <span className="font-mono text-[11px] text-text-muted">{formatBytes(child.sizeBytes)}</span>
                {child.isDirectory && (
                  <ChevronRight size={11} className="text-text-muted" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomizedContent({ depth, x, y, width, height, index, payload, name, size = 0 }: any) {
  const color = COLORS[((payload?.children?.length ?? 0) + (index ?? 0)) % COLORS.length];
  const fill = payload?.color ?? color;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: `${fill}40`,
          stroke: `${fill}80`,
          strokeWidth: 1 / (depth + 1),
          strokeOpacity: 1 / (depth + 1) * 2,
          cursor: "pointer",
        }}
      />
      {width > 40 && height > 20 && (
        <>
          <text
            x={x + 4}
            y={y + 12}
            fontSize={Math.min(11, width / 8)}
            fill="var(--color-text-primary)"
            dominantBaseline="hanging"
          >
            {payload?.name ?? name}
          </text>
          <text
            x={x + 4}
            y={y + 24}
            fontSize={Math.min(10, width / 10)}
            fill="var(--color-text-muted)"
            dominantBaseline="hanging"
          >
            {formatBytes(size)}
          </text>
        </>
      )}
    </g>
  );
}
