import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type SourceFieldNodeData = {
  label: string;
  dataType?: string;
  status?: 'mapped' | 'unmapped';
  nodeWidth?: number;
  hideDataType?: boolean;
  draggable?: boolean; // if true, hide the mapping handle to prevent dragging from source node 
};
export type SourceFieldNodeType = Node<SourceFieldNodeData, 'sourceField'>;

function SourceFieldNodeComponent({ data }: NodeProps<SourceFieldNodeType>) {
  const width = data.nodeWidth ?? 220;
  const hideDataType = data.hideDataType === true;
  const hideMapping = data.draggable === true;

  return (
    <div
      className="h-[40px] flex items-center gap-2 px-3 rounded-md border border-border shadow-sm"
      style={{ width }}
    >
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{data.label}</span>

      {!hideDataType && (
        <span
          className="shrink-0 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
        >
          {data.dataType ?? 'TEXT'}
        </span>
      )}
      {!hideMapping && (
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-primary !bg-background" />
      )}
    </div>
  );
}

export const SourceFieldNode = memo(SourceFieldNodeComponent);