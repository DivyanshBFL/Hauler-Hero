import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type DataIssueGroup, type IssueRow } from "@/services/api";
import {
  Loader2,
  Search,
  Sparkles,
  Copy,
  MapPin,
  ChevronDown,
  Replace,
  Scissors,
  AlignLeft,
  PlusSquare,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  FileClock,
  EllipsisVertical,
  Cross,
  X,
} from "lucide-react";
import { PAGE_OUTER, PAGE_CONTAINER } from "@/constants/layout";
import ProcessStepper from "@/components/ProcessStepper";
import IssueCellDetailsDrawer from "@/components/data-cleaning/IssueCellDetailsDrawer";
import ColumnActionDialog from "@/components/data-cleaning/ColumnActionDialog";
import DedupeOverlay from "@/components/data-cleaning/DedupeOverlay";
import ActivityLogDrawer from "@/components/data-cleaning/ActivityLogDrawer";
import type {
  ActivityLogItem,
  ColumnAction,
  ColumnActionModal,
  DedupeCondition,
  DedupeMode,
  DedupeMethod,
  DedupeKeepStrategy,
  DrawerType,
  IssueCellPanel,
  KeepRemove,
  PreviewRow,
  DedupePreviewResult,
  RowEdit,
  CommitMeta,
} from "@/components/data-cleaning/types";
import { toast } from "sonner";

const sessionStartRequestCache = new Map<string, Promise<any>>();

const CLEANING_DATA_KEY = "selectedMappedRows";
const PAGE_SIZE = 100;
const ORIGINAL_CLEANING_DATA_KEY = "originalMappedRows";
const CLEANED_DATA_KEY = "cleanedMappedRows";
const MAX_HISTORY = 50;

const COLUMN_MENU_ITEMS: {
  action: ColumnAction;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    action: "replaceValues",
    label: "Replace values",
    icon: <Replace className="h-4 w-4" />,
  },
  {
    action: "trimSpaces",
    label: "Trim spaces",
    icon: <Scissors className="h-4 w-4" />,
  },
  {
    action: "truncateValues",
    label: "Truncate values",
    icon: <AlignLeft className="h-4 w-4" />,
  },
  {
    action: "addPrefixOrSuffix",
    label: "Add prefix or suffix",
    icon: <PlusSquare className="h-4 w-4" />,
  },
];

function isCellMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const v = String(value).trim().toLowerCase();
  return v === "" || v === "na" || v === "n/a" || v === "null";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  const low = s.toLowerCase();
  if (low === "na" || low === "n/a" || low === "null") return "";
  return s;
}

type ApiErrorShape = {
  message?: string;
  detail?: string;
  error?: string;
  response?: {
    data?: {
      message?: string;
      detail?: string;
      error?: string;
    };
  };
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const e = error as ApiErrorShape;
  return (
    e.response?.data?.message ||
    e.response?.data?.detail ||
    e.response?.data?.error ||
    e.message ||
    e.detail ||
    e.error ||
    fallback
  );
}

function showApiErrorToast(error: unknown, fallback: string) {
  toast.error(getApiErrorMessage(error, fallback));
}

function getAddressColumns(columns: string[]): string[] {
  const r = /(address|street|city|state|zip|postal|country|location)/i;
  return columns.filter((c) => r.test(c));
}

function getIssueColumnsMap(issues: DataIssueGroup[]): Record<string, number> {
  const map: Record<string, number> = {};
  issues.forEach((i) => {
    map[i.column] = (map[i.column] ?? 0) + i.count;
  });
  return map;
}

function hasFilledCondition(c: DedupeCondition): boolean {
  return !!c.column && c.value.trim().length > 0;
}

function toCamelCaseIssue(value: string): string {
  return value.replace(/[_-](\w)/g, (_, c: string) => c.toUpperCase());
}

function toIssueLabel(value: string): string {
  if (value === "allIssues") return "All Issues";
  // Replace underscores with spaces and capitalize
  const withSpaces = value.replace(/_/g, " ");
  const camelSpaced = withSpaces.replace(/([A-Z])/g, " $1").trim();
  return camelSpaced.charAt(0).toUpperCase() + camelSpaced.slice(1);
}

export function DataCleaningPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [visibleRows, setVisibleRows] = useState<Record<string, any>[]>([]);
  const [issues, setIssues] = useState<DataIssueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [editLog, setEditLog] = useState<RowEdit[]>([]);
  const [editSeqCounter, setEditSeqCounter] = useState(1);
  // Track which edits belong to each history snapshot index
  const [historyEditLog, setHistoryEditLog] = useState<RowEdit[][]>([[]]); // parallel to history[]

  const [history, setHistory] = useState<Record<string, any>[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [serverRedoAvailable, setServerRedoAvailable] = useState(0);
  const [serverUndoAvailable, setServerUndoAvailable] = useState(0);

  const [currentPage, setCurrentPage] = useState(0);
  const [fetchingPage, setFetchingPage] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);

  const [drawer, setDrawer] = useState<DrawerType>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [workedOnCells, setWorkedOnCells] = useState<Set<string>>(new Set());
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyDedupLoading, setApplyDedupLoading] = useState(false);
  const [dedupeError, setDedupeError] = useState<string | null>(null);
  const [previewDuplicateCount, setPreviewDuplicateCount] = useState(0);

  const [dedupeMode, setDedupeMode] = useState<DedupeMode>("column");
  const [dedupeColumns, setDedupeColumns] = useState<string[]>([]);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [keepRemove, setKeepRemove] = useState<KeepRemove>("keep");
  const [flagDuplicates, setFlagDuplicates] = useState(false);
  const [dedupeMethod, setDedupeMethod] = useState<DedupeMethod>("automatic");
  const [dedupeKeepStrategy, setDedupeKeepStrategy] =
    useState<DedupeKeepStrategy>("oldest");

  const [columnActionModal, setColumnActionModal] =
    useState<ColumnActionModal | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
  } | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");

  const [fixingAddresses, setFixingAddresses] = useState(false);
  const [originalRows, setOriginalRows] = useState<Record<string, any>[]>([]);
  const [rowIssueMap, setRowIssueMap] = useState<
    Record<number, Record<string, string[]>>
  >({});
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [selectedIssueType, setSelectedIssueType] =
    useState<string>("allIssues");
  const [conditions, setConditions] = useState<DedupeCondition[]>([
    { column: "", operator: "is", value: "" },
  ]);
  const [columnPickerValue, setColumnPickerValue] = useState("");
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [issueCellPanel, setIssueCellPanel] = useState<IssueCellPanel | null>(
    null,
  );

  const issueSummaryRef = useRef<HTMLDivElement | null>(null);
  const dedupeDefaultsInitializedRef = useRef(false);

  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activityLogError, setActivityLogError] = useState<string | null>(null);

  const activityIdRef = useRef(1);
  const sessionIdRef = useRef<string | null>(null);

  const [autoFixConfirmOpen, setAutoFixConfirmOpen] = useState(false);
  const [autoFixDrawerMounted, setAutoFixDrawerMounted] = useState(false);
  const [autoFixDrawerVisible, setAutoFixDrawerVisible] = useState(false);
  const [autoFixSubmitting, setAutoFixSubmitting] = useState(false);
  const [autoFixError, setAutoFixError] = useState<string | null>(null);
  const [issueSummaryOpen, setIssueSummaryOpen] = useState(false);
  const [issueCountByType, setIssueCountByType] = useState<
    Record<string, number>
  >({});
  const [sessionIssueSummary, setSessionIssueSummary] = useState<
    Record<string, { columns?: string[]; row_count?: number }>
  >({});

  const [addressFixConfirmOpen, setAddressFixConfirmOpen] = useState(false);
  const [addressFixSubmitting, setAddressFixSubmitting] = useState(false);
  const [addressFixError, setAddressFixError] = useState<string | null>(null);

  const [proceedConfirmOpen, setProceedConfirmOpen] = useState(false);

  const [progress, setProgress] = useState(0);
  const [autoFixOptions, setAutoFixOptions] = useState({
    datatype_fix: true,
    phone_action: "standardize" as "standardize" | "clear" | null,
    email_action: "standardize" as "standardize" | "clear" | null,
    missing_value_fix: true,
    field_length_fix: true,
    deduplication: true,
  });

  useEffect(() => {
    if (autoFixConfirmOpen) {
      setAutoFixDrawerVisible(false);
      setAutoFixDrawerMounted(true);
      const timeoutId = window.setTimeout(
        () => setAutoFixDrawerVisible(true),
        10,
      );
      return () => window.clearTimeout(timeoutId);
    }

    setAutoFixDrawerVisible(false);
    const timeoutId = window.setTimeout(
      () => setAutoFixDrawerMounted(false),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [autoFixConfirmOpen]);

  const closeAutoFixDrawer = () => {
    if (autoFixSubmitting) return;
    setAutoFixConfirmOpen(false);
    setAutoFixError(null);
  };

  type CleaningNavigationState = {
    selectedMappedRows?: Record<string, any>[];
    session_id?: string;
    sessionId?: string;
  };

  const columns = useMemo(() => {
    // Use originalRows as the stable source for columns to prevent shifts if first row has missing keys
    const dataSource =
      originalRows.length > 0 ? originalRows[0] : (allRows[0] ?? {});
    return Object.keys(dataSource).filter(
      (c) => !c.startsWith("__") && c !== "_row_id",
    );
  }, [originalRows, allRows]);
  const addActivityLog = useCallback(
    (entry: Omit<ActivityLogItem, "id" | "timestamp">) => {
      const item: ActivityLogItem = {
        id: activityIdRef.current++,
        kind: entry.kind,
        actor: entry.actor,
        title: entry.title,
        description: entry.description,
        timestamp: new Date().toLocaleString(),
      };
      setActivityLog((prev) => [...prev, item]);
    },
    [],
  );
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        issueSummaryOpen &&
        issueSummaryRef.current &&
        !issueSummaryRef.current.contains(event.target as Node)
      ) {
        setIssueSummaryOpen(false); // Close the panel
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [issueSummaryOpen]);

  const summarizeEdits = useCallback((edits: Omit<RowEdit, "seq">[]) => {
    if (!edits.length) return "No value changes";
    const first = edits[0];
    const fromVal = first.old_value || "";
    const toVal = first.new_value || "";
    if (edits.length === 1) {
      return `Row ${first.row_index + 1} • ${first.column}: "${fromVal}" → "${toVal}"`;
    }
    return `Updated ${edits.length} cells. Example: Row ${first.row_index + 1} • ${first.column}: "${fromVal}" → "${toVal}"`;
  }, []);

  const buildDiffEdits = useCallback(
    (
      beforeRows: Record<string, any>[],
      afterRows: Record<string, any>[],
      targetColumns: string[] = columns,
    ): Omit<RowEdit, "seq">[] => {
      const oldMap = new Map<number, Record<string, any>>();
      beforeRows.forEach((r, i) => oldMap.set(Number(r.__rowIndex ?? i), r));

      const edits: Omit<RowEdit, "seq">[] = [];
      afterRows.forEach((r, i) => {
        const rowIndex = Number(r.__rowIndex ?? i);
        const oldRow = oldMap.get(rowIndex);
        if (!oldRow) return;

        targetColumns.forEach((col) => {
          const oldVal = displayValue(oldRow[col]);
          const newVal = displayValue(r[col]);
          if (oldVal !== newVal) {
            edits.push({
              row_index: rowIndex,
              column: col,
              old_value: oldVal,
              new_value: newVal,
            });
          }
        });
      });

      return edits;
    },
    [columns],
  );

  const addressColumns = useMemo(() => getAddressColumns(columns), [columns]);
  const issueByColumn = useMemo(() => getIssueColumnsMap(issues), [issues]);

  const pushHistory = useCallback(
    (rows: Record<string, any>[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const next = [...sliced, JSON.parse(JSON.stringify(rows))];
        return next.slice(-MAX_HISTORY);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    },
    [historyIndex],
  );

  const canUndo = historyIndex > 0 || serverUndoAvailable > 0;
  const canRedo = historyIndex < history.length - 1 || serverRedoAvailable > 0;

  const availableIssueTypes = useMemo(() => {
    if (issueTypes.length) return issueTypes;

    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.issue_type) set.add(toCamelCaseIssue(i.issue_type));
    });
    return Array.from(set).sort();
  }, [issueTypes, issues]);

  const issueGroupCount = availableIssueTypes.length;

  const getActiveSessionId = useCallback((): string | null => {
    return (
      sessionIdRef.current ??
      new URLSearchParams(location.search).get("session_id") ??
      sessionStorage.getItem("session_id")
    );
  }, [location.search]);

  const processIssuesData = useCallback((issuesData: any) => {
    const rows = issuesData?.rows || [];
    const summary = (issuesData?.summary ?? {}) as Record<
      string,
      { columns?: string[]; row_count?: number; issue_count?: number }
    >;
    const issueCounts = issuesData?.issue_counts || {};

    setSessionIssueSummary(summary);

    const nextIssueMap: Record<number, Record<string, string[]>> = {};
    const nextTypes = new Set<string>();
    const perIssueType: Record<string, number> = {};
    const perColumn: Record<string, { count: number; rows: Set<number> }> = {};

    rows.forEach((r: any) => {
      const idx = r.row_index;
      const rowIssues = r.issues || {};
      nextIssueMap[idx] = rowIssues;
      Object.entries(rowIssues).forEach(([col, issueList]) => {
        const list = issueList as string[];
        list.forEach((issue) => {
          nextTypes.add(issue);
          perIssueType[issue] = (perIssueType[issue] ?? 0) + 1;
        });
        if (!perColumn[col]) {
          perColumn[col] = { count: 0, rows: new Set() };
        }
        perColumn[col].count += list.length;
        perColumn[col].rows.add(idx);
      });
    });

    setRowIssueMap(nextIssueMap);
    setIssueTypes(Array.from(nextTypes).sort());
    setIssueCountByType(
      Object.keys(issueCounts).length ? issueCounts : perIssueType,
    );

    const groupedIssues: DataIssueGroup[] = Object.entries(perColumn).map(
      ([column, v]) => ({
        issue_type: "session_issue",
        column,
        count: v.count,
        rows: Array.from(v.rows),
        severity: [column],
        description: `${v.count} issue(s) detected in ${column}.`,
      }),
    );
    setIssues(groupedIssues);
  }, []);

  const refreshRowsFromSession = useCallback(async () => {
    const sid = getActiveSessionId();
    if (!sid) return null;

    const payload = await api.refreshedData(sid);

    if (typeof payload.redo_available === "number") {
      setServerRedoAvailable(payload.redo_available);
    }
    if (typeof payload.step_count === "number") {
      setServerUndoAvailable(payload.step_count);
    }

    if (payload.issues) {
      processIssuesData(payload.issues);
    }

    const rows = payload.issues?.rows || [];

    if (!rows.length) return null;

    return rows
      .map((r: any, idx: number) => {
        const rowIndexRaw = r?.row_index ?? r?.rowIndex ?? r?.__rowIndex ?? idx;
        const rowIndex = Number(rowIndexRaw);
        const data = r?.data && typeof r.data === "object" ? r.data : r;

        if (!Number.isFinite(rowIndex) || !data || typeof data !== "object")
          return null;

        const existingRow =
          allRows.find((prev) => Number(prev.__rowIndex) === rowIndex) || {};

        return {
          ...existingRow,
          ...data,
          __rowIndex: rowIndex,
          _issues: r.issues || null, // Capture cell-level issues
        };
      })
      .filter((row: Record<string, any> | null): row is Record<string, any> =>
        Boolean(row),
      );
  }, [getActiveSessionId, allRows, processIssuesData]);

  const getActiveDedupeColumns = useCallback((): string[] => {
    if (dedupeMode === "row") return columns;
    return dedupeColumns;
  }, [dedupeMode, dedupeColumns, columns]);

  const getActiveConditions = useCallback(() => {
    return conditions.filter(hasFilledCondition).map((c) => ({
      column: c.column,
      operator: c.operator,
      value: c.value.trim(),
    }));
  }, [conditions]);

  const buildDedupePayload = useCallback(
    (_forPreview: boolean) => {
      const activeColumns = getActiveDedupeColumns();
      const activeConditions = getActiveConditions();

      if (dedupeMode === "column") {
        const payload: any = {
          type: dedupeMode,
          columns: activeColumns,
          method: dedupeMethod,
          ignore_case: ignoreCase,
          ignore_whitespace: ignoreWhitespace,
        };

        if (dedupeMethod === "manual") {
          payload.condition_mode = keepRemove;
          payload.conditions = activeConditions;
        } else if (dedupeMethod === "automatic") {
          payload.keep_strategy = dedupeKeepStrategy;
        }

        return payload;
      } else {
        return {
          type: dedupeMode,
          ignore_case: ignoreCase,
          ignore_whitespace: ignoreWhitespace,
        };
      }
    },
    [
      dedupeMode,
      dedupeMethod,
      dedupeKeepStrategy,
      getActiveDedupeColumns,
      getActiveConditions,
      ignoreCase,
      ignoreWhitespace,
      keepRemove,
    ],
  );

  const parsePreviewResponse = useCallback(
    (
      previewPayload: any,
      candidateColumns: string[],
    ): DedupePreviewResult | null => {
      const normalizedColumns = candidateColumns.length
        ? candidateColumns
        : getActiveDedupeColumns();

      const resultRows: PreviewRow[] = [];

      const pushRow = (
        input: any,
        shadedDefault = false,
        fallbackIndex?: number,
      ) => {
        if (!input) return;

        const directRow =
          input?.data && typeof input.data === "object" ? input.data : input;
        const rowIndexRaw =
          input?.row_index ??
          input?.rowIndex ??
          input?.__rowIndex ??
          input?._row_id ??
          directRow?.row_index ??
          directRow?.__rowIndex ??
          directRow?._row_id;

        let rowIndex = Number(rowIndexRaw);
        if (!Number.isFinite(rowIndex)) {
          rowIndex = Number.isFinite(fallbackIndex)
            ? Number(fallbackIndex)
            : resultRows.length;
        }

        const mappedFromSource = allRows.find(
          (r) => Number(r.__rowIndex) === rowIndex,
        );
        const row =
          directRow && typeof directRow === "object"
            ? {
                ...(mappedFromSource ?? {}),
                ...directRow,
                __rowIndex: rowIndex,
              }
            : mappedFromSource;

        if (!row || typeof row !== "object") return;

        const shaded =
          Boolean(input?.shaded) ||
          Boolean(input?.is_duplicate) ||
          Boolean(input?.duplicate) ||
          shadedDefault;

        resultRows.push({
          rowIndex,
          row,
          shaded,
        });
      };

      if (Array.isArray(previewPayload)) {
        previewPayload.forEach((row: any, idx: number) =>
          pushRow(row, false, idx),
        );
      }

      if (!resultRows.length && Array.isArray(previewPayload?.rows)) {
        previewPayload.rows.forEach((row: any, idx: number) =>
          pushRow(row, false, idx),
        );
      }

      if (
        !resultRows.length &&
        Array.isArray(previewPayload?.duplicate_groups)
      ) {
        previewPayload.duplicate_groups.forEach((group: any) => {
          const indexed =
            (Array.isArray(group?.row_indexes) && group.row_indexes) ||
            (Array.isArray(group?.indices) && group.indices) ||
            [];

          if (indexed.length) {
            indexed.forEach((rowIndex: number, idx: number) => {
              pushRow({ row_index: rowIndex }, idx > 0);
            });
            return;
          }

          if (Array.isArray(group?.rows)) {
            group.rows.forEach((row: any, idx: number) =>
              pushRow(row, idx > 0),
            );
          }
        });
      }

      if (!resultRows.length) return null;

      const inferredColumns = normalizedColumns.length
        ? normalizedColumns
        : Object.keys(resultRows[0]?.row ?? {}).filter(
            (c) => !c.startsWith("__"),
          );

      return {
        rows: resultRows,
        previewColumns: inferredColumns,
      };
    },
    [allRows, getActiveDedupeColumns],
  );

  const buildRowsFromServiceResponse = useCallback(
    (response: any): Record<string, any>[] | null => {
      const removedRowIndicesRaw =
        (Array.isArray(response?.removed_row_indices) &&
          response.removed_row_indices) ||
        (Array.isArray(response?.removedRows) && response.removedRows) ||
        null;

      if (removedRowIndicesRaw) {
        const removedSet = new Set<number>(
          removedRowIndicesRaw
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v)),
        );
        return allRows
          .filter((row) => !removedSet.has(Number(row.__rowIndex)))
          .map((row) => ({ ...row, _isDuplicate: false }));
      }

      const rowCandidates =
        (Array.isArray(response?.issues?.rows) && response.issues.rows) ||
        (Array.isArray(response?.rows) && response.rows) ||
        (Array.isArray(response?.data) && response.data) ||
        (Array.isArray(response?.updated_rows) && response.updated_rows) ||
        (Array.isArray(response?.cleaned_rows) && response.cleaned_rows) ||
        (Array.isArray(response?.result?.rows) && response.result.rows) ||
        (Array.isArray(response?.result?.data) && response.result.data) ||
        null;

      if (!rowCandidates) return null;

      const parsed = rowCandidates
        .map((item: any) => {
          const base =
            item?.data && typeof item.data === "object" ? item.data : item;
          const rowIndexRaw =
            item?.row_index ??
            item?.rowIndex ??
            item?.__rowIndex ??
            base?.row_index ??
            base?.__rowIndex;

          const rowIndex = Number(rowIndexRaw);
          if (!Number.isFinite(rowIndex) || !base || typeof base !== "object")
            return null;

          const existingRow =
            allRows.find((prev) => Number(prev.__rowIndex) === rowIndex) || {};

          return {
            ...existingRow,
            ...base,
            __rowIndex: rowIndex,
            _isDuplicate: false,
          };
        })
        .filter((row: Record<string, any> | null): row is Record<string, any> =>
          Boolean(row),
        );

      if (!parsed.length) return null;

      return parsed;
    },
    [allRows],
  );

  const buildDedupeRemovalEdits = useCallback(
    (beforeRows: Record<string, any>[], afterRows: Record<string, any>[]) => {
      const edits: Omit<RowEdit, "seq">[] = [];

      const nextIndexSet = new Set<number>(
        afterRows
          .map((r) => Number(r.__rowIndex))
          .filter((idx) => Number.isFinite(idx)),
      );

      beforeRows.forEach((row, idx) => {
        const rowIndex = Number(row.__rowIndex ?? idx);
        if (!nextIndexSet.has(rowIndex)) {
          columns.forEach((col) => {
            edits.push({
              row_index: rowIndex,
              column: col,
              old_value: displayValue(row[col]),
              new_value: "__REMOVED__",
            });
          });
        }
      });

      edits.push(...buildDiffEdits(beforeRows, afterRows));
      return edits;
    },
    [buildDiffEdits, columns],
  );

  const runIssueAnalysis = async (data: Record<string, any>[]) => {
    setAnalyzing(true);
    try {
      const result = await api.analyzeDataIssues(data);
      console.log("Result:", result.issues);
      setIssues(result.issues ?? []);
    } catch (error) {
      showApiErrorToast(error, "Failed to analyze issues");
    } finally {
      setAnalyzing(false);
    }
  };

  const loadNextPage = useCallback(async () => {
    if (fetchingPage || !hasMorePages || !allRows.length) return;
    setFetchingPage(true);
    try {
      const nextPage = currentPage + 1;
      const result = await api.getCleaningRowsPage({
        rows: allRows,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setVisibleRows((prev) => [...prev, ...result.rows]);
      setCurrentPage(nextPage);
      setHasMorePages(result.hasMore);
    } catch (error) {
      showApiErrorToast(error, "Failed to load next page");
    } finally {
      setFetchingPage(false);
    }
  }, [allRows, currentPage, fetchingPage, hasMorePages]);

  const resetVirtualRows = useCallback(async (rows: Record<string, any>[]) => {
    setVisibleRows([]);
    setCurrentPage(0);
    setHasMorePages(true);
    setFetchingPage(false);
    try {
      const first = await api.getCleaningRowsPage({
        rows,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setVisibleRows(first.rows);
      setCurrentPage(1);
      setHasMorePages(first.hasMore);
    } catch (error) {
      showApiErrorToast(error, "Failed to load rows");
      throw error;
    }
  }, []);

  const loadSessionStartIssues = useCallback(
    async (sessionId: string, forceRefresh = false) => {
      try {
        let request;
        if (!forceRefresh) {
          request = sessionStartRequestCache.get(sessionId);
        }

        if (!request) {
          request = api.startSession(sessionId);
          sessionStartRequestCache.set(sessionId, request);
        }
        const payload = await request;

        if (typeof payload.redo_available === "number") {
          setServerRedoAvailable(payload.redo_available);
        }
        if (typeof payload.step_count === "number") {
          setServerUndoAvailable(payload.step_count);
        }

        const rows = payload.issues?.rows || [];

        if (payload.issues) {
          processIssuesData(payload.issues);
        }

        return rows;
      } catch (error) {
        // Clear table data and show error message
        setAllRows([]);
        setVisibleRows([]);
        setRowIssueMap({});
        setIssues([]);
        setIssueTypes([]);
        setIssueCountByType({});
        setSessionIssueSummary({});
        toast.error(
          error instanceof Error
            ? `Failed to load session issues: ${error.message}`
            : "Failed to load session issues. Please try again.",
        );
        throw error; // Re-throw the error if needed for further handling
      }
    },
    [processIssuesData],
  );

  const handleUndoStable = useCallback(async () => {
    if (!canUndo) return;
    try {
      const sid = getActiveSessionId();
      if (sid) {
        const response = await api.rollback(sid, 1);
        sessionStartRequestCache.delete(sid); // Clear cache on rollback
        if (typeof response?.step_count === "number") {
          setServerUndoAvailable(response.step_count);
        }
        if (typeof response?.redo_available === "number") {
          setServerRedoAvailable(response.redo_available);
        }

        if (historyIndex > 0) {
          const idx = historyIndex - 1;
          const rows = history[idx];
          setHistoryIndex(idx);
          setAllRows(rows);
          setEditLog(historyEditLog[idx] ?? []);
          await resetVirtualRows(rows);
        }

        // Always refresh from server to ensure issues and state are in sync after rollback
        const issueRows = await loadSessionStartIssues(sid, true);
        const refreshedRows = (issueRows || []).map((r: IssueRow) => ({
          ...r.data,
          __rowIndex: r.row_index,
          _issues: r.issues || null,
        }));

        setAllRows(refreshedRows);
        await resetVirtualRows(refreshedRows);

        addActivityLog({
          kind: "action",
          actor: "user",
          title: "Undo",
          description: "Reverted last change",
        });
        toast.success("Undo completed successfully.");
      }
    } catch (error) {
      showApiErrorToast(error, "Failed to undo");
    }
  }, [
    canUndo,
    history,
    historyIndex,
    editLog,
    resetVirtualRows,
    historyEditLog,
    addActivityLog,
    getActiveSessionId,
    loadSessionStartIssues,
  ]);

  const handleRedoStable = useCallback(async () => {
    if (!canRedo) return;
    try {
      const sid = getActiveSessionId();
      if (sid) {
        const response = await api.redo(sid, 1);
        sessionStartRequestCache.delete(sid); // Clear cache on redo
        if (typeof response?.redo_available === "number") {
          setServerRedoAvailable(response.redo_available);
        }
        if (typeof response?.step_count === "number") {
          setServerUndoAvailable(response.step_count);
        }
      }

      const hasNextLocal = historyIndex < history.length - 1;
      let finalRows: Record<string, any>[] = [];

      if (hasNextLocal) {
        const idx = historyIndex + 1;
        const nextRows = history[idx];
        setHistoryIndex(idx);
        setAllRows(nextRows);
        setEditLog(historyEditLog[idx] ?? []);
        finalRows = nextRows;
      }

      // Refresh from server after redo to sync issues
      if (sid) {
        const issueRows = await loadSessionStartIssues(sid, true);
        const refreshedRows = (issueRows || []).map((r: IssueRow) => ({
          ...r.data,
          __rowIndex: r.row_index,
          _issues: r.issues || null,
        }));
        setAllRows(refreshedRows);
        finalRows = refreshedRows;
      }

      addActivityLog({
        kind: "action",
        actor: "user",
        title: "Redo",
        description: "Reapplied reverted change",
      });

      if (finalRows.length > 0) {
        await resetVirtualRows(finalRows);
      }
      toast.success("Redo completed successfully.");
    } catch (error) {
      showApiErrorToast(error, "Failed to redo");
    }
  }, [
    canRedo,
    history,
    historyIndex,
    resetVirtualRows,
    historyEditLog,
    addActivityLog,
    getActiveSessionId,
    loadSessionStartIssues,
  ]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-col-menu-root="true"]'))
        setOpenColumnMenu(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const navigationState =
      (location.state as CleaningNavigationState | null) ?? null;
    const rowsFromNavigation = navigationState?.selectedMappedRows;

    const init = async () => {
      let initialRows: Record<string, any>[] = [];
      let loadedFromSession = false;
      const sessionId =
        new URLSearchParams(location.search).get("session_id") ??
        navigationState?.session_id ??
        navigationState?.sessionId ??
        sessionStorage.getItem("session_id");

      if (sessionId) {
        try {
          sessionStorage.setItem("session_id", sessionId);
          sessionIdRef.current = sessionId;
          const issueRows = await loadSessionStartIssues(sessionId);
          if (issueRows.length) {
            initialRows = issueRows.map((r: IssueRow) => ({
              ...r.data,
              __rowIndex: r.row_index,
            }));
            loadedFromSession = true;
          }
        } catch {
          /* fallback */
        }
      }

      if (!loadedFromSession) {
        if (rowsFromNavigation?.length) {
          initialRows = rowsFromNavigation;
        } else {
          const source = sessionStorage.getItem(CLEANING_DATA_KEY);
          if (!source) {
            navigate("/data-preview");
            return;
          }
          initialRows = JSON.parse(source) as Record<string, any>[];
        }
        initialRows = initialRows.map((r, idx) => ({ ...r, __rowIndex: idx }));
      }

      const baseline = JSON.parse(JSON.stringify(initialRows)) as Record<
        string,
        any
      >[];
      setOriginalRows(baseline);
      sessionStorage.setItem(
        ORIGINAL_CLEANING_DATA_KEY,
        JSON.stringify(baseline),
      );

      setAllRows(initialRows);
      setHistory([JSON.parse(JSON.stringify(initialRows))]);
      setHistoryIndex(0);

      setEditLog([]);
      setEditSeqCounter(1);
      setHistoryEditLog([[]]);
      activityIdRef.current = 1;
      setActivityLog([]);

      const sourceName =
        sessionStorage.getItem("uploadedFileName") ?? "Uploaded dataset.xlsx";
      const sheetName = sessionStorage.getItem("uploadedSheetName") ?? "Sheet1";

      addActivityLog({
        kind: "source",
        actor: "system",
        title: "Data source",
        description: sourceName,
      });
      addActivityLog({
        kind: "import",
        actor: "system",
        title: `Imported from ${sourceName} and excel sheet ${sheetName}`,
      });

      await resetVirtualRows(initialRows);
      if (!loadedFromSession) await runIssueAnalysis(initialRows);
      setLoading(false);
    };

    void init();
  }, [
    location.state,
    location.search,
    navigate,
    resetVirtualRows,
    loadSessionStartIssues,
    addActivityLog,
  ]);

  const handleContinue = async () => {
    setSubmitting(true);
    setProceedConfirmOpen(false);
    try {
      sessionStorage.setItem(CLEANED_DATA_KEY, JSON.stringify(allRows));

      const sid =
        sessionIdRef.current ??
        new URLSearchParams(location.search).get("session_id") ??
        sessionStorage.getItem("session_id");

      if (!sid) throw new Error("Session ID is missing.");
      if (editLog.length) {
        const requestBody = { edits: editLog }; // Include the edit log
        await api.submitSessionEdits(sid, requestBody);

        addActivityLog({
          kind: "action",
          actor: "user",
          title: "Process Data",
          description: `Submitted ${editLog.length} edit(s) to /edit/${sid}`,
        });
        toast.success("Process Data completed successfully.");
      }
      navigate("/data-analytics", {
        state: {
          cleanedMappedData: allRows,
          originalMappedData: originalRows.length ? originalRows : allRows,
          editLog,
        },
      });
    } catch (error) {
      showApiErrorToast(error, "Failed to submit edits");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextClick = () => {
    let hasIssues = false;
    for (const row of allRows) {
      const rowIndex = Number(row.__rowIndex);
      for (const col of columns) {
        const cellIssues = rowIssueMap[rowIndex]?.[col] ?? [];
        const hasCellIssue = cellIssues.length > 0;
        const isMissingValue = isCellMissing(row[col]);
        const cellKey = getCellKey(rowIndex, col);
        const isWorkedOn = workedOnCells.has(cellKey);

        if (!isWorkedOn && (hasCellIssue || isMissingValue)) {
          hasIssues = true;
          break;
        }
      }
      if (hasIssues) break;
    }

    if (hasIssues) {
      setProceedConfirmOpen(true);
    } else {
      void handleContinue();
    }
  };

  const handleOpenActivityLog = useCallback(async () => {
    setActivityLogOpen(true);
    setActivityLogError(null);
    setActivityLogLoading(true);

    try {
      const sid = getActiveSessionId();
      if (!sid) throw new Error("Missing session id for activity log");

      const payload = await api.getActivityLog(sid);
      const steps = Array.isArray(payload?.activity)
        ? payload.activity
        : Array.isArray(payload?.steps)
          ? payload.steps
          : [];

      if (typeof payload?.total_applied === "number") {
        setServerUndoAvailable(payload.total_applied);
      }
      if (typeof payload?.redo_available === "number") {
        setServerRedoAvailable(payload.redo_available);
      }

      const mapped: ActivityLogItem[] = steps.map((step: any, idx: number) => {
        const issueTypeRaw = String(step?.issue_type ?? "issue");
        const issueType = toIssueLabel(toCamelCaseIssue(issueTypeRaw));
        const column = step?.column ? String(step.column) : "Multiple columns";
        const action = String(step?.action ?? "manual").toLowerCase();
        const rowsAffected = Number(step?.rows_affected ?? 0);

        return {
          id: Number(step?.step ?? idx + 1),
          kind: "action",
          actor: action === "auto" ? "ai" : "user",
          title: `${issueType}${column !== "Multiple columns" ? ` - ${column}` : ""}`,
          description: `${action === "auto" ? "Auto" : "Manual"} action on ${rowsAffected} row(s)`,
          // timestamp: new Date().toLocaleString(),
        };
      });

      setActivityLog(mapped);
    } catch (error) {
      setActivityLog([]);
      setActivityLogError(
        error instanceof Error ? error.message : "Failed to load activity log",
      );
      showApiErrorToast(error, "Failed to load activity log");
    } finally {
      setActivityLogLoading(false);
    }
  }, [getActiveSessionId]);

  useEffect(() => {
    setConditions((prev) =>
      prev.map((c) => ({ ...c, column: c.column || columns[0] || "" })),
    );
  }, [columns, dedupeColumns.length]);

  const filteredVisibleRows = useMemo(() => {
    let rows = visibleRows;
    const hasIssueMap = Object.keys(rowIssueMap).length > 0;

    if (hasIssueMap) {
      rows = rows.map((row) => {
        const rowIndex = row.__rowIndex;
        const hasIssues = rowIssueMap[rowIndex];
        const wasFixed = !hasIssues && row._wasFixed; // Check if the row was fixed

        return {
          ...row,
          _rowClass: wasFixed ? "bg-green-100" : hasIssues ? "bg-red-100" : "",
        };
      });
    }

    if (!search.trim()) return rows;

    const q = search.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => displayValue(r[c]).toLowerCase().includes(q)),
    );
  }, [visibleRows, search, columns, rowIssueMap, selectedIssueType]);
  useEffect(() => {
    setPreviewDuplicateCount(0);
  }, [
    dedupeMode,
    dedupeColumns,
    dedupeMethod,
    dedupeKeepStrategy,
    ignoreCase,
    ignoreWhitespace,
    keepRemove,
    conditions,
  ]);

  const duplicateIndicatorCount = previewDuplicateCount;

  const uniqueAffectedRows = useMemo(() => {
    const set = new Set<number>();
    issues.forEach((issue) => issue.rows?.forEach((idx) => set.add(idx)));
    return set.size;
  }, [issues]);

  const commitRows = useCallback(
    async (
      next: Record<string, any>[],
      newEdits?: Omit<RowEdit, "seq">[],
      meta: CommitMeta = { actor: "user", actionLabel: "Data cleanup update" },
    ) => {
      let updatedEditLog = editLog;
      let seqCounter = editSeqCounter;

      if (newEdits?.length) {
        const sequencedEdits: RowEdit[] = newEdits.map((e) => ({
          ...e,
          seq: seqCounter++,
        }));
        updatedEditLog = [...editLog, ...sequencedEdits];
        setEditSeqCounter(seqCounter);
        setEditLog(updatedEditLog);

        addActivityLog({
          kind: "action",
          actor: meta.actor ?? "user",
          title: meta.actionLabel ?? "Data cleanup update",
          description: summarizeEdits(newEdits),
        });
      }

      // Mark rows as fixed
      const fixedRows = next.map((row) => {
        const rowIndex = row.__rowIndex;
        const wasFixed = rowIssueMap[rowIndex] && !rowIssueMap[rowIndex].length;
        return { ...row, _wasFixed: wasFixed };
      });

      setHistoryEditLog((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const updated = [...sliced, updatedEditLog];
        return updated.slice(-MAX_HISTORY);
      });

      pushHistory(fixedRows);
      setAllRows(fixedRows);
      await resetVirtualRows(fixedRows);
    },
    [
      editLog,
      editSeqCounter,
      historyIndex,
      pushHistory,
      resetVirtualRows,
      addActivityLog,
      summarizeEdits,
      rowIssueMap,
    ],
  );

  const clearCellIssue = useCallback((rowIndex: number, column: string) => {
    setRowIssueMap((prev) => {
      const rowIssues = prev[rowIndex];
      if (!rowIssues?.[column]?.length) return prev;

      const next = { ...prev, [rowIndex]: { ...rowIssues } };
      delete next[rowIndex][column];

      if (!Object.keys(next[rowIndex]).length) {
        delete next[rowIndex];
      }

      return next;
    });
  }, []);

  const applyCellEdit = useCallback(
    async (rowIndex: number, column: string, nextValueRaw: string) => {
      const nextValue = nextValueRaw;
      const current = allRows.find((r) => Number(r.__rowIndex) === rowIndex);
      const oldValue = displayValue(current?.[column]);

      if (oldValue === nextValue) {
        setEditingCell(null);
        return;
      }

      // Update local state immediately (optimistic update)
      setAllRows((prev) =>
        prev.map((r) =>
          Number(r.__rowIndex) === rowIndex ? { ...r, [column]: nextValue } : r,
        ),
      );

      setVisibleRows((prev) =>
        prev.map((r) =>
          Number(r.__rowIndex) === rowIndex ? { ...r, [column]: nextValue } : r,
        ),
      );

      // Create the edit entry
      const newEdit: RowEdit = {
        seq: editSeqCounter,
        row_index: rowIndex,
        column,
        old_value: oldValue,
        new_value: nextValue,
      };

      setEditSeqCounter((prev) => prev + 1);
      setEditLog((prevLog) => [...prevLog, newEdit]);
      setEditingCell(null);

      // Mark cell as worked on IMMEDIATELY (yellow background shows instantly)
      const cellKey = getCellKey(rowIndex, column);
      setWorkedOnCells((prev) => new Set([...prev, cellKey]));

      // Submit to API
      try {
        const sid = getActiveSessionId();
        if (!sid) throw new Error("Missing session id for cell edit");

        // Submit this single edit
        await api.submitSessionEdits(sid, { edits: [newEdit] });

        // Refresh rows from session to get updated data
        const refreshedRows = await refreshRowsFromSession();
        if (refreshedRows?.length) {
          setAllRows(refreshedRows);
          await resetVirtualRows(refreshedRows);
        }

        toast.success("Cell updated successfully.");
      } catch (error) {
        showApiErrorToast(error, "Failed to update cell");
        // Optionally rollback if needed
        // setAllRows(prev => prev.map(r =>
        //   Number(r.__rowIndex) === rowIndex ? { ...r, [column]: oldValue } : r
        // ));
      }
    },
    [
      allRows,
      editSeqCounter,
      getActiveSessionId,
      refreshRowsFromSession,
      resetVirtualRows,
    ],
  );

  useEffect(() => {
    if (!dedupeDefaultsInitializedRef.current && columns.length) {
      // setDedupeColumns(columns.slice(0, Math.min(2, columns.length)));
      dedupeDefaultsInitializedRef.current = true;
    }

    setConditions((prev) =>
      prev.map((c) => ({
        ...c,
        column: c.column || columns[0] || "",
      })),
    );
  }, [columns]);

  useEffect(() => {
    if (
      selectedIssueType !== "allIssues" &&
      !availableIssueTypes.includes(selectedIssueType)
    ) {
      setSelectedIssueType("allIssues");
    }
  }, [availableIssueTypes, selectedIssueType]);

  const getCellKey = (rowIndex: number, column: string): string => {
    return `${rowIndex}:${column}`;
  };

  const buildPreview = async () => {
    const cols = getActiveDedupeColumns();
    if (!cols.length) return;

    setDedupeError(null);
    setPreviewLoading(true);
    try {
      const sessionId = getActiveSessionId();
      if (!sessionId)
        throw new Error("Missing session id for deduplicate preview");

      const payload = buildDedupePayload(true);

      const response = await api.dedupPreview(sessionId, payload);
      const duplicateCount = Number(response?.duplicate_count);
      setPreviewDuplicateCount(
        Number.isFinite(duplicateCount) ? duplicateCount : 0,
      );

      const parsed = parsePreviewResponse(response?.preview, cols);
      setPreviewColumns(parsed?.previewColumns ?? cols);
      setPreviewRows(parsed?.rows ?? []);
      setPreviewOpen(true);
    } catch (error) {
      setPreviewRows([]);
      setPreviewColumns(cols);
      setPreviewDuplicateCount(0);

      setDedupeError(
        error instanceof Error
          ? `Preview service error: ${error.message}`
          : "Preview service error. Unable to load duplicate preview.",
      );
      showApiErrorToast(error, "Failed to generate duplicate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAutoFixAllIssues = async () => {
    if (!issues.length || !allRows.length) return;
    setAutoFixError(null);
    setAutoFixSubmitting(true);
    try {
      const sid = getActiveSessionId();
      if (!sid) throw new Error("Missing session id for auto-fix");
      setAutoFixSubmitting(true);
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + 5;
        });
      }, 300);

      const response = await api.autoFix(sid, autoFixOptions);

      const refreshedRows = await refreshRowsFromSession();
      const backendRows =
        refreshedRows && refreshedRows.length
          ? refreshedRows
          : buildRowsFromServiceResponse(response);

      if (!backendRows || !backendRows.length) {
        throw new Error("Auto-fix response did not return updated rows.");
      }

      const edits = buildDiffEdits(allRows, backendRows);
      await commitRows(backendRows, edits, {
        actor: "ai",
        actionLabel: "Auto-fix all issues",
      });

      // only needed when refresh fails and fallback is used
      if (!refreshedRows?.length) {
        await runIssueAnalysis(backendRows);
      }
      clearInterval(interval);
      setProgress(100);
      setAutoFixConfirmOpen(false);
      toast.success("Auto-fix completed successfully.");
    } catch (error) {
      setAutoFixError(
        error instanceof Error ? error.message : "Auto-fix failed",
      );
      showApiErrorToast(error, "Auto-fix failed");
    } finally {
      setAutoFixSubmitting(false);
    }
  };
  const handleRemoveDuplicates = async () => {
    const activeColumns = getActiveDedupeColumns();
    if (!activeColumns.length) return;
    setDedupeError(null);
    setApplyDedupLoading(true);

    try {
      const sessionId = getActiveSessionId();
      if (!sessionId)
        throw new Error("Missing session id for deduplicate apply");

      const payload = buildDedupePayload(false);

      const response = await api.dedupApply(sessionId, payload);

      const refreshedRows = await refreshRowsFromSession();
      const backendRows =
        refreshedRows && refreshedRows.length
          ? refreshedRows
          : buildRowsFromServiceResponse(response);
      if (!backendRows)
        throw new Error(
          "Deduplicate apply response did not return updated rows",
        );

      const dedupeEdits = buildDedupeRemovalEdits(allRows, backendRows);
      await commitRows(backendRows, dedupeEdits, {
        actor: "user",
        actionLabel: "Remove duplicates",
      });
      if (!refreshedRows?.length) {
        await runIssueAnalysis(backendRows);
      }
      setPreviewDuplicateCount(0);
      setPreviewOpen(false);
      setDrawer(null);
      toast.success("Deduplicate completed successfully.");
    } catch (error) {
      setDedupeError(
        error instanceof Error
          ? `Deduplicate service error: ${error.message}`
          : "Deduplicate service error. Please try again.",
      );
      showApiErrorToast(error, "Deduplicate failed");
    } finally {
      setApplyDedupLoading(false);
    }
  };

  const handleProceedFixAddresses = async () => {
    setAddressFixError(null);
    setAddressFixSubmitting(true);
    try {
      const sid = getActiveSessionId();
      if (!sid) throw new Error("Missing session id for address fix");
      setAddressFixSubmitting(true);
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + 5;
        });
      }, 300);

      const response = await api.addressCorrector(sid);

      const refreshedRows = await refreshRowsFromSession();
      const backendRows =
        refreshedRows && refreshedRows.length
          ? refreshedRows
          : buildRowsFromServiceResponse(response);

      if (!backendRows || !backendRows.length) {
        throw new Error("Address fix response did not return updated rows.");
      }

      const edits = buildDiffEdits(allRows, backendRows);
      await commitRows(backendRows, edits, {
        actor: "ai",
        actionLabel: "Address fix",
      });

      // only needed when refresh fails and fallback is used
      if (!refreshedRows?.length) {
        await runIssueAnalysis(backendRows);
      }
      clearInterval(interval);
      setProgress(100);
      setAddressFixConfirmOpen(false);
      toast.success("Addresses fixed successfully.");
    } catch (error) {
      setAddressFixError(
        error instanceof Error ? error.message : "Address fix failed",
      );
      showApiErrorToast(error, "Address fix failed");
    } finally {
      setAddressFixSubmitting(false);
    }
  };
  const handleOperationApplied = useCallback(
    async (column: string, result: any) => {
      addActivityLog({
        kind: "action",
        actor: "user",
        title: "Column operation applied",
        description: `Changes applied to column: ${column} `,
      });

      try {
        const sid = getActiveSessionId();
        if (!sid)
          throw new Error("Missing session id for column operation refresh");

        const refreshedRows = await refreshRowsFromSession();
        const backendRows =
          refreshedRows && refreshedRows.length
            ? refreshedRows
            : buildRowsFromServiceResponse(result);
        if (!backendRows || !backendRows.length) {
          throw new Error("No refreshed rows returned from data endpoint");
        }

        const edits = buildDiffEdits(allRows, backendRows, [column]);
        await commitRows(backendRows, edits, {
          actor: "user",
          actionLabel: "Column operation applied",
        });

        // Mark affected cells as worked on (yellow background)
        const cellsToMarkAsWorked = new Set<string>();
        edits.forEach((edit) => {
          cellsToMarkAsWorked.add(getCellKey(edit.row_index, edit.column));
        });
<<<<<<< HEAD
        setWorkedOnCells(prev => new Set([...prev, ...cellsToMarkAsWorked]));
=======
        setWorkedOnCells((prev) => new Set([...prev, ...cellsToMarkAsWorked]));
>>>>>>> 4a4db1a4bf53e84e3b9bbcd07e0da80cfc80bca0

        if (!refreshedRows?.length) {
          await runIssueAnalysis(backendRows);
        }
      } catch (error) {
        showApiErrorToast(
          error,
          "Failed to refresh rows after column operation",
        );
      }
    },
    [
      addActivityLog,
      getActiveSessionId,
      refreshRowsFromSession,
      buildRowsFromServiceResponse,
      buildDiffEdits,
      allRows,
      commitRows,
      runIssueAnalysis,
    ],
  );

  const handleColumnOperationApplied = useCallback(
    async (
      column: string,
      result: { changedRowCount: number; columnProfile: any },
    ) => {
      addActivityLog({
        kind: "action",
        actor: "user",
        title: "Column operation applied",
        description: `Column: ${column}, ${result.changedRowCount} row(s) changed`,
      });

      try {
        const sid = getActiveSessionId();
        if (!sid)
          throw new Error("Missing session id for column operation refresh");

        const refreshedRows = await refreshRowsFromSession();
        const backendRows =
          refreshedRows && refreshedRows.length
            ? refreshedRows
            : buildRowsFromServiceResponse(result);
        if (!backendRows || !backendRows.length) {
          throw new Error("No refreshed rows returned from data endpoint");
        }

        const edits = buildDiffEdits(allRows, backendRows, [column]);
        await commitRows(backendRows, edits, {
          actor: "user",
          actionLabel: "Column operation applied",
        });

        if (!refreshedRows?.length) {
          await runIssueAnalysis(backendRows);
        }
      } catch (error) {
        showApiErrorToast(
          error,
          "Failed to refresh rows after column operation",
        );
      } finally {
        setColumnActionModal(null);
      }
    },
    [
      addActivityLog,
      getActiveSessionId,
      loadSessionStartIssues,
      refreshRowsFromSession,
      buildRowsFromServiceResponse,
      buildDiffEdits,
      allRows,
      commitRows,
      runIssueAnalysis,
    ],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">
            Loading data cleaning workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_OUTER}>
      <div className={PAGE_CONTAINER}>
        <div className="mb-4">
          <ProcessStepper />
        </div>

        <Card className="shadow-lg border border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className=" text-sm font-normal">
                    Data Clean-up Workspace
                  </CardTitle>
                  <div className="relative mt-1 inline-block">
                    <CardDescription className="text-xs text-muted-foreground">
                      <span>
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2 hover:text-primary/80"
                          onMouseEnter={() => setIssueSummaryOpen(true)}
                          onMouseLeave={() => setIssueSummaryOpen(false)}
                        >
                          Issue Summary
                        </button>{" "}
                        | {uniqueAffectedRows} affected rows | {allRows.length}{" "}
                        total rows
                      </span>
                    </CardDescription>

                    {issueSummaryOpen && (
                      <div
                        ref={issueSummaryRef}
                        className="absolute left-0 top-full z-30 mt-2 w-[260px] max-w-[90vw] rounded-md border border-border bg-background p-3 text-xs shadow-xl"
                      >
                        <p className="font-semibold text-foreground mb-2 flex items-center justify-between gap-4">
                          <span>Total Issues</span>
                          <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium ml-auto">
                            {Object.values(issueCountByType || {}).reduce(
                              (acc, curr) => acc + curr,
                              0,
                            )}
                          </span>
                        </p>
                        {Object.keys(issueCountByType).length ? (
                          <div className="space-y-1 mb-3">
                            {Object.entries(issueCountByType).map(
                              ([issueType, count]) => (
                                <div
                                  key={issueType}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="text-muted-foreground">
                                    {toIssueLabel(issueType)}
                                  </span>
                                  <span className="font-medium text-foreground ml-auto pr-2">
                                    {count}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground mb-3">
                            No issue detail available.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {analyzing && (
                  <p className="text-xs text-primary mt-1 inline-flex items-center">
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Re-analyzing...
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canUndo}
                  onClick={handleUndoStable}
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canRedo}
                  onClick={handleRedoStable}
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  disabled={!issues.length || analyzing || autoFixSubmitting}
                  onClick={() => {
                    setAutoFixError(null);
                    setAutoFixConfirmOpen(true);
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4 text-blue-500 fill-blue-400 animate-blink" />
                  Auto Cleanup
                </Button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-700 border-blue-300 hover:bg-blue-50 px-2"
                      aria-label="Open quick actions"
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-52"
                  >
                    <DropdownMenuItem
                      onClick={() => void handleOpenActivityLog()}
                      className="cursor-pointer focus:text-blue-700 focus:bg-blue-50 data-[highlighted]:bg-blue-50"
                    >
                      <FileClock className="mr-2 h-4 w-4" />
                      Activity Log
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setPreviewDuplicateCount(0);
                        setDedupeError(null);
                        setPreviewRows([]);
                        setPreviewColumns([]);
                        setPreviewOpen(false);
                        setDrawer("dedupe");
                      }}
                      className="cursor-pointer focus:text-blue-700 focus:bg-blue-50 data-[highlighted]:bg-blue-50"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Deduplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setAutoFixError(null);
                        setAddressFixConfirmOpen(true);
                      }}
                      className="cursor-pointer focus:text-blue-700 focus:bg-blue-50 data-[highlighted]:bg-blue-50"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Fix Addresses
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col md:flex-row gap-2 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <select
                  value={selectedIssueType}
                  onChange={(e) => setSelectedIssueType(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="allIssues">
                    {toIssueLabel("allIssues")} (
                    {Object.values(issueCountByType || {}).reduce(
                      (acc, curr) => acc + curr,
                      0,
                    )}
                    )
                  </option>
                  {availableIssueTypes.map((type) => (
                    <option key={type} value={type}>
                      {toIssueLabel(type)} ({issueCountByType[type] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-md border border-border overflow-hidden mt-4">
              <div
                className="max-h-[500px] overflow-y-auto rounded-md"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120)
                    void loadNextPage();
                }}
              >
                <Table className="w-full text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow>
                      {columns.map((col) => {
                        const hasIssue = (issueByColumn[col] ?? 0) > 0;
                        console.log("has Issues for:", col, issueByColumn[col]);
                        return (
                          <TableHead
                            key={col}
                            className="font-normal relative px-2 py-3 text-left whitespace-nowrap bg-gray-50"
                          >
                            <span
                              className={`absolute left-0 right-0 top-0 h-1 transition-colors duration-200 mx-[1px] ${hasIssue ? "bg-red-400" : "bg-emerald-400"}`}
                            />
                            <div className="flex items-center gap-1 mt-1">
                              <span>{col}</span>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const issueTypesForColumn = Array.from(
                                    new Set(
                                      issues
                                        .filter((i) => i.column === col)
                                        .map((i) =>
                                          toCamelCaseIssue(i.issue_type),
                                        ),
                                    ),
                                  );
                                  setIssueCellPanel({
                                    rowIndex: -1,
                                    column: col,
                                    value: "",
                                    issueTypes: issueTypesForColumn,
                                  });
                                }}
                              >
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredVisibleRows.map((row, idx) => {
                      const rowIndex = Number(row.__rowIndex ?? idx);
                      return (
                        <TableRow key={`r-${rowIndex}`} className="">
                          {columns.map((col) => {
                            const cellIssues =
                              rowIssueMap[rowIndex]?.[col] ?? [];
                            const visibleCellIssues =
                              selectedIssueType === "allIssues"
                                ? cellIssues
                                : cellIssues.filter(
                                    (x) => x === selectedIssueType,
                                  );
                            let hasCellIssue = visibleCellIssues.length > 0;

                            const cellKey = getCellKey(rowIndex, col);
                            const isWorkedOn = workedOnCells.has(cellKey);
                            const isMissingValue = isCellMissing(row[col]);
                            const bgClass = isWorkedOn
                              ? "bg-yellow-100"
                              : hasCellIssue || isMissingValue
                                ? "bg-red-50"
                                : "";

                            return (
                              <TableCell
                                key={`c-${rowIndex}-${col}`}
                                className={`px-1 py-2 whitespace-nowrap ${bgClass} ${hasCellIssue ? "cursor-pointer bg-clip-content" : ""}`}
                                title={
                                  hasCellIssue
                                    ? visibleCellIssues
                                        .map(toIssueLabel)
                                        .join(", ")
                                    : undefined
                                }
                                onClick={() => {
                                  if (!hasCellIssue) return;
                                  setEditingCell({ rowIndex, column: col });
                                  setEditedValue(displayValue(row[col]));
                                }}
                              >
                                {editingCell?.rowIndex === rowIndex &&
                                editingCell?.column === col ? (
                                  <input
                                    type="text"
                                    value={editedValue}
                                    onChange={(e) =>
                                      setEditedValue(e.target.value)
                                    }
                                    onBlur={() => {
                                      applyCellEdit(rowIndex, col, editedValue);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        applyCellEdit(
                                          rowIndex,
                                          col,
                                          editedValue,
                                        );
                                      } else if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    className="w-full px-2 py-1 border border-gray-300 rounded"
                                  />
                                ) : (
                                  <span style={{ padding: "5px" }}>
                                    {displayValue(row[col]) || ""}
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {fetchingPage && (
                      <TableRow>
                        <TableCell
                          colSpan={Math.max(columns.length, 1)}
                          className="px-3 py-3 text-center text-muted-foreground"
                        >
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Loading more rows...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
          <div className="flex flex-col sm:flex-row justify-between px-6 py-3 border-t bg-muted">
            <Button
              variant="outline"
              className="border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
              onClick={() => navigate("/data-preview")}
            >
              <svg
                className="mr-2 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Button>
<<<<<<< HEAD
            <Button onClick={handleNextClick} disabled={submitting}
              variant='outline'
=======
            <Button
              onClick={handleContinue}
              disabled={submitting}
              variant="outline"
>>>>>>> 4a4db1a4bf53e84e3b9bbcd07e0da80cfc80bca0
              className="w-full sm:w-auto  border-primary text-primary font-semibold order-1 hover:bg-primary/10 transition-colors px-5 pr-3"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Next
              <svg
                className="ml-2 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>
        </Card>
      </div>

      <IssueCellDetailsDrawer
        panel={issueCellPanel}
        sessionId={getActiveSessionId()}
        onClose={() => setIssueCellPanel(null)}
        onOperationApplied={handleOperationApplied}
        toIssueLabel={toIssueLabel}
      />

      <ColumnActionDialog
        modal={columnActionModal}
        menuItems={COLUMN_MENU_ITEMS.map((m) => ({
          action: m.action,
          label: m.label,
        }))}
        sessionId={getActiveSessionId()}
        onOperationApplied={handleColumnOperationApplied}
        onClose={() => setColumnActionModal(null)}
      />

      <DedupeOverlay
        drawer={drawer}
        previewOpen={previewOpen}
        setDrawer={setDrawer}
        setPreviewOpen={setPreviewOpen}
        previewColumns={previewColumns}
        previewRows={previewRows}
        displayValue={displayValue}
        dedupeError={dedupeError}
        dedupeMode={dedupeMode}
        setDedupeMode={setDedupeMode}
        duplicateIndicatorCount={duplicateIndicatorCount}
        ignoreCase={ignoreCase}
        setIgnoreCase={setIgnoreCase}
        ignoreWhitespace={ignoreWhitespace}
        setIgnoreWhitespace={setIgnoreWhitespace}
        dedupeColumns={dedupeColumns}
        setDedupeColumns={setDedupeColumns}
        columnPickerValue={columnPickerValue}
        setColumnPickerValue={setColumnPickerValue}
        columns={columns}
        keepRemove={keepRemove}
        setKeepRemove={setKeepRemove}
        conditions={conditions}
        setConditions={setConditions}
        previewLoading={previewLoading}
        applyDedupLoading={applyDedupLoading}
        onBuildPreview={buildPreview}
        onRemoveDuplicates={handleRemoveDuplicates}
        flagDuplicates={flagDuplicates}
        setFlagDuplicates={setFlagDuplicates}
        dedupeMethod={dedupeMethod}
        setDedupeMethod={setDedupeMethod}
        dedupeKeepStrategy={dedupeKeepStrategy}
        setDedupeKeepStrategy={setDedupeKeepStrategy}
      />

      <ActivityLogDrawer
        open={activityLogOpen}
        loading={activityLogLoading}
        error={activityLogError}
        items={activityLog}
        onClose={() => setActivityLogOpen(false)}
      />

      {autoFixDrawerMounted && (
        <div className="fixed inset-0 z-[70]">
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${autoFixDrawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeAutoFixDrawer}
          />
          <div
            className={`absolute right-0 top-0 z-10 h-full w-full max-w-[560px] bg-white border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${autoFixDrawerVisible ? "translate-x-0" : "translate-x-full"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-6 border-b border-border bg-white flex items-center justify-between shrink-0">
              <h3 className="text-md leading-none font-light text-foreground">
                Data Cleanup Rules
              </h3>
              <button
                type="button"
                disabled={autoFixSubmitting}
                onClick={closeAutoFixDrawer}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-4">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-y-2">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2">
                    {[
                      { key: "datatype_fix", label: "Fix Data Type Issues" },
                      {
                        key: "missing_value_fix",
                        label: "Handle Missing Field Values",
                      },
                      {
                        key: "field_length_fix",
                        label: "Fix Field Length Violations",
                      },
                      {
                        key: "deduplication",
                        label: "Remove Duplicate Data Records",
                      },
                    ].map((opt) => (
                      <>
                        <div key={opt.key} className="space-y-2 px-6">
                          <label className="text-sm text-foreground">
                            {opt.label}
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group text-xs">
                              <input
                                type="radio"
                                name={opt.key}
                                checked={
                                  autoFixOptions[
                                    opt.key as keyof typeof autoFixOptions
                                  ] === true
                                }
                                onChange={() =>
                                  setAutoFixOptions({
                                    ...autoFixOptions,
                                    [opt.key]: true,
                                  })
                                }
                                className="w-4 h-4 accent-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="text-xs group-hover:text-primary transition-colors">
                                Yes
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="radio"
                                name={opt.key}
                                checked={
                                  autoFixOptions[
                                    opt.key as keyof typeof autoFixOptions
                                  ] === false
                                }
                                onChange={() =>
                                  setAutoFixOptions({
                                    ...autoFixOptions,
                                    [opt.key]: false,
                                  })
                                }
                                className="w-4 h-4 accent-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="text-xs group-hover:text-primary transition-colors">
                                No
                              </span>
                            </label>
                          </div>
                        </div>
                        <hr className="w-full" />
                      </>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        key: "phone_action",
                        label:
                          "Select The Cleanup Action For Invalid Phone Number Entries",
                      },
                      {
                        key: "email_action",
                        label:
                          "Define The Preferred Treatment For Invalid Email Address Entries",
                      },
                    ].map((opt) => (
                      <>
                        <div key={opt.key} className="space-y-3 px-6">
                          <label className="text-sm text-foreground">
                            {opt.label}
                          </label>
                          <div className="flex flex-row flex-wrap gap-4">
                            {[
                              { value: "standardize", label: "Standardize" },
                              { value: "clear", label: "Clear" },
                              { value: "null", label: "Skip" },
                            ].map((choice) => (
                              <label
                                key={choice.value}
                                className="flex items-center gap-2.5 cursor-pointer group"
                              >
                                <input
                                  type="radio"
                                  name={opt.key}
                                  checked={
                                    (choice.value === "null" &&
                                      autoFixOptions[
                                        opt.key as keyof typeof autoFixOptions
                                      ] === null) ||
                                    autoFixOptions[
                                      opt.key as keyof typeof autoFixOptions
                                    ] === choice.value
                                  }
                                  onChange={() =>
                                    setAutoFixOptions({
                                      ...autoFixOptions,
                                      [opt.key]:
                                        choice.value === "null"
                                          ? null
                                          : choice.value,
                                    })
                                  }
                                  className="w-4 h-4 accent-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-xs group-hover:text-primary transition-colors">
                                  {choice.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <hr className="w-full" />
                      </>
                    ))}
                  </div>
                </div>

<<<<<<< HEAD
              <div className="shrink-0 border-t border-border bg-white p-4 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={autoFixSubmitting}
                  onClick={closeAutoFixDrawer}
                  className="h-10 px-5"
                >
                  Cancel
                </Button>
                <Button
                  disabled={autoFixSubmitting}
                  onClick={() => void handleAutoFixAllIssues()}
                  variant='outline'
                  className='bg-white text-primary border-primary hover:bg-blue-100 '
                >
                  {autoFixSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply Fixes
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {
        addressFixConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (addressFixSubmitting) return;
                setAddressFixConfirmOpen(false);
                setAddressFixError(null);
              }}
            />
            <div className="relative z-10 w-full max-w-xl rounded-md border border-border bg-background shadow-2xl overflow-hidden">
              <div className="py-4 border-b flex items-center justify-between">
                <h3 className="flex items-center text-md leading-none font-light text-foreground px-4">
                  <span className="mr-2"><MapPin className="h-4 w-4" /></span>
                  <span>Auto-fix Addresses</span>
                </h3>

                <div className='px-4'>
                  <X onClick={() => {
                    setAddressFixConfirmOpen(false)
                  }} />
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  One-click cleanup that automatically fixes address issues in the dataset.
                  {'\n'}All fixes are logged step-by-step. ✨
                </p>
                {addressFixError && (
                  <p className="text-xs text-destructive mt-3">{addressFixError}</p>
=======
                {autoFixError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-destructive font-medium">
                      {autoFixError}
                    </p>
                  </div>
>>>>>>> 4a4db1a4bf53e84e3b9bbcd07e0da80cfc80bca0
                )}

                {autoFixSubmitting && (
                  <div className="w-full space-y-3 bg-muted/30 p-4 rounded-lg">
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center font-medium">
                      {progress < 100
                        ? `Processing auto-fix... ${progress}%`
                        : "Processed successfully ✅"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-white p-4 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                disabled={autoFixSubmitting}
                onClick={closeAutoFixDrawer}
                className="h-10 px-5"
              >
                Cancel
              </Button>
              <Button
                disabled={autoFixSubmitting}
                onClick={() => void handleAutoFixAllIssues()}
                variant="outline"
                className="bg-white text-primary border-primary "
              >
                {autoFixSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Apply Fixes
              </Button>
            </div>
          </div>
<<<<<<< HEAD
        )
      }

      {
        proceedConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (submitting) return;
                setProceedConfirmOpen(false);
              }}
            />
            <div className="relative z-10 w-full max-w-xl rounded-md border border-border bg-background shadow-2xl overflow-hidden">
              <div className="py-4 border-b flex items-center justify-between">
                <h3 className="text-md leading-none font-light text-foreground px-4">Outstanding Issues Alert</h3>

                <div className='px-4'>
                  <X className="cursor-pointer" onClick={() => {
                    if (submitting) return;
                    setProceedConfirmOpen(false);
                  }} />
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  Some data anomalies were not resolved. Proceeding may result in inconsistencies. Do you want to Proceed?
                </p>
              </div>

              <div className="p-4 border-t flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  className="px-6 "
                  disabled={submitting}
                  onClick={() => {
                    setProceedConfirmOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleContinue()} disabled={submitting} variant="outline" className="px-5 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors ">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Proceed
                </Button>
              </div>
            </div>
          </div>
        )
      }
=======
        </div>
      )}

      {addressFixConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (addressFixSubmitting) return;
              setAddressFixConfirmOpen(false);
              setAddressFixError(null);
            }}
          />
          <div className="relative z-10 w-full max-w-xl rounded-md border border-border bg-background shadow-2xl overflow-hidden">
            <div className="py-4 border-b flex items-center justify-between">
              <h3 className="text-md leading-none font-light text-foreground px-4">
                Auto-fix Addresses
              </h3>

              <div className="px-4">
                <X
                  onClick={() => {
                    setAddressFixConfirmOpen(false);
                  }}
                />
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                One-click cleanup that automatically fixes address issues in the
                dataset.
                {"\n"}All fixes are logged step-by-step. ✨
              </p>
              {addressFixError && (
                <p className="text-xs text-destructive mt-3">
                  {addressFixError}
                </p>
              )}
              {addressFixSubmitting && (
                <div className="mt-4 w-full">
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {progress < 100
                      ? `Processing auto-fix... ${progress}%`
                      : "Processed successfully ✅"}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="px-6 "
                onClick={() => {
                  setAddressFixConfirmOpen(false);
                  setAddressFixError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleProceedFixAddresses()}
                disabled={addressFixSubmitting}
                variant="outline"
                className="px-5 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors "
              >
                {addressFixSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Proceed
              </Button>
            </div>
          </div>
        </div>
      )}
>>>>>>> 4a4db1a4bf53e84e3b9bbcd07e0da80cfc80bca0
      {/* Navigation Arrows */}
      <button
        onClick={() => navigate("/data-preview")}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-3  transition-all duration-200 px-1 rounded-md bg-black opacity-40 text-white shadow-lg"
        title="Previous: Data Preview"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        onClick={handleNextClick}
        disabled={submitting}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 transition-all duration-200 disabled:opacity-50 rounded-md bg-black opacity-40  text-white shadow-lg px-1"
        title="Next: Data Analytics"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}
