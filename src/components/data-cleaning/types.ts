export type DrawerType = 'dedupe' | 'address' | null;
export type DedupeMode = 'column' | 'row';
export type DedupeMethod = 'automatic' | 'manual';
export type KeepRemove = 'keep' | 'remove';
export type DedupeKeepStrategy = 'oldest' | 'latest' | 'max_filled';

export type DedupeCondition = {
    column: string;
    operator: 'is' | 'is_not' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
    value: string;
};

export type PreviewRow = {
    rowIndex: number;
    row: Record<string, any>;
    shaded: boolean;
};

export type IssueCellPanel = {
    rowIndex: number;
    column: string;
    value: string;
    issueTypes: string[];
};

export type ColumnAction =
    | 'replaceValues'
    | 'trimSpaces'
    | 'truncateValues'
    | 'addPrefixOrSuffix';

export type ColumnActionModal = {
    column: string;
    action: ColumnAction;
};

export type ActivityActor = 'system' | 'user' | 'ai';
export type ActivityKind = 'source' | 'import' | 'action';

export type ActivityLogItem = {
    id: number;
    kind: ActivityKind;
    actor: ActivityActor;
    title: string;
    description?: string;
    timestamp: string;
};

export type DedupePreviewResult = {
  rows: PreviewRow[];
  previewColumns: string[];
};

export type RowEdit = {
  seq: number;
  row_index: number;
  column: string;
  old_value: string;
  new_value: string;
};

export type CommitMeta = {
  actor?: ActivityActor;
  actionLabel?: string;
};