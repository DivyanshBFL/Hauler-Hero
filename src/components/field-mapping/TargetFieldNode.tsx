import { memo, type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type TargetFieldNodeData = {
  label: ReactNode;
  fieldName: string;
  dataType?: string;
  status?: "mapped" | "unmapped";
  nodeWidth?: number;
  isWarning?: boolean;
  onUnmap?: (fieldName: string) => void;
};
export type TargetFieldNodeType = Node<TargetFieldNodeData, "targetField">;

function TargetFieldNodeComponent({ data }: NodeProps<TargetFieldNodeType>) {
  const width = data.nodeWidth ?? 220;

  return (
    <div
      className="h-[30px] flex items-center gap-2 px-3 rounded-lg border border-border shadow-sm"
      style={{ width }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-[#c5c5c5] !bg-background"
      />
      <span className="min-w-0 flex-1 text-xs font-medium text-foreground truncate">
        {data.label}
      </span>
      <span className="shrink-0 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
        {data.dataType ?? "TEXT"}
      </span>
    </div>
  );
}

export const TargetFieldNode = memo(TargetFieldNodeComponent);
