import { memo, type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import AILogo from "@/../public/ai-primarycolor.svg?react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export type TargetFieldNodeData = {
  label: ReactNode;
  fieldName: string;
  dataType?: string;
  status?: "mapped" | "unmapped";
  nodeWidth?: number;
  isWarning?: boolean;
  isAutoMapped?: boolean;
  onUnmap?: (fieldName: string) => void;
};
export type TargetFieldNodeType = Node<TargetFieldNodeData, "targetField">;

function TargetFieldNodeComponent({ data }: NodeProps<TargetFieldNodeType>) {
  const width = data.nodeWidth ?? 220;

  return (
    <div
      className="h-[30px] flex items-center gap-2 px-3 rounded-lg border border-[#00000070] shadow-sm"
      style={{ width, boxSizing: "border-box" }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-[#c5c5c5] !bg-background"
      />
      <span className="min-w-0 flex-1 text-xs font-medium text-foreground truncate">
        {data.label}
      </span>
      {data.isAutoMapped && (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* <span className="shrink-0 text-[11px] font-normal px-2 py-0.5 rounded-md flex gap-2 cursor-pointer"> */}
            <AILogo className="w-3.5 h-3.5 text-primary heartbeat" />
            {/* </span> */}
          </TooltipTrigger>
          <TooltipContent side="left">Mapped</TooltipContent>
        </Tooltip>
      )}
      <span className="shrink-0 text-[11px] font-normal px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
        {data.dataType ?? "TEXT"}
      </span>
    </div>
  );
}

export const TargetFieldNode = memo(TargetFieldNodeComponent);
