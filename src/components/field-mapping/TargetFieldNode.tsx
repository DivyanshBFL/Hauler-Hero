import { memo, type ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type TargetFieldNodeData = {
  label: ReactNode;
  fieldName: string;
  dataType?: string;
  status?: 'mapped' | 'unmapped';
  nodeWidth?: number;
  isWarning?: boolean;
  onUnmap?: (fieldName: string) => void;
};
export type TargetFieldNodeType = Node<TargetFieldNodeData, 'targetField'>;

function TargetFieldNodeComponent({ data }: NodeProps<TargetFieldNodeType>) {
  const width = data.nodeWidth ?? 220;

  return (
    <div
      className="h-[40px] flex items-center gap-2 px-3 rounded-lg border border-border shadow-sm"
      style={{ width }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-[#c5c5c5] !bg-background" />
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{data.label}</span>
      <span
        className="shrink-0 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
      >
        {data.dataType ?? 'TEXT'}
      </span>
      {data.status === 'mapped' && data.onUnmap && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onUnmap!(data.fieldName);
          }}
          className="ml-auto p-1 rounded-full hover:bg-rose-100 text-rose-500 transition-colors"
          title="Unmap field"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const TargetFieldNode = memo(TargetFieldNodeComponent);