import { File, FileText, Image, Archive, Music, Video, Code } from "lucide-react";
import clsx from "clsx";
import { formatBytes } from "@/types";
import Checkbox from "./Checkbox";

interface FileRowProps {
  name: string;
  path: string;
  sizeBytes: number;
  modified?: string | null;
  selected: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}

const EXT_ICONS: Record<string, React.ElementType> = {
  txt: FileText,
  md: FileText,
  json: Code,
  xml: Code,
  js: Code,
  ts: Code,
  rs: Code,
  py: Code,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  webp: Image,
  svg: Image,
  ico: Image,
  zip: Archive,
  tar: Archive,
  gz: Archive,
  rar: Archive,
  "7z": Archive,
  mp3: Music,
  wav: Music,
  flac: Music,
  aac: Music,
  mp4: Video,
  mov: Video,
  avi: Video,
  mkv: Video,
  webm: Video,
};

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = EXT_ICONS[ext] ?? File;
  return <Icon size={14} className="text-text-muted shrink-0" strokeWidth={1.6} />;
}

export default function FileRow({ name, path, sizeBytes, modified, selected, onToggle, style }: FileRowProps) {
  return (
    <div
      style={style}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        selected ? "bg-accent-dim" : "hover:bg-bg-elevated"
      )}
    >
      <Checkbox checked={selected} onChange={onToggle} />
      <FileIcon name={name} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-primary truncate">{name}</div>
        <div className="text-[10px] text-text-muted truncate font-mono">{path}</div>
      </div>
      {modified && (
        <span className="text-[10px] text-text-muted font-mono whitespace-nowrap hidden sm:block">
          {new Date(modified).toLocaleDateString()}
        </span>
      )}
      <span className="text-[11px] text-text-secondary font-mono whitespace-nowrap tabular-nums">
        {formatBytes(sizeBytes)}
      </span>
    </div>
  );
}
