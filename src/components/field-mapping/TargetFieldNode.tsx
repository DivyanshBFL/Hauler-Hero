import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type TargetFieldNodeData = {
  label: string;
  dataType?: string;
  status?: 'mapped' | 'unmapped';
  nodeWidth?: number;
  isWarning?: boolean;
};
export type TargetFieldNodeType = Node<TargetFieldNodeData, 'targetField'>;

function TargetFieldNodeComponent({ data }: NodeProps<TargetFieldNodeType>) {
  const isMapped = data.status === 'mapped';
  const width = data.nodeWidth ?? 220;
  const isWarning = data.isWarning === true;

  return (
    <div
      className="h-[40px] flex items-center gap-2 px-3 rounded-lg border border-border shadow-sm"
      style={{ width }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-primary !bg-background" />
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{data.label}</span>
      <span
        className={`shrink-0 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md ${
          isMapped
            ? 'bg-emerald-200 text-emerald-800'
            : isWarning
              ? 'bg-yellow-200 text-yellow-800'
              : 'bg-rose-200 text-rose-800'
        }`}
      >
        {data.dataType ?? 'TEXT'}
      </span>
    </div>
  );
}

export const TargetFieldNode = memo(TargetFieldNodeComponent);