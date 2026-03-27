import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, Eye, Filter } from "lucide-react";
import {
  getDefaultImportStats,
  IMPORT_STATS_KEY,
  type ImportStats,
} from "@/types/importStats";
import { PAGE_OUTER, PAGE_CONTAINER } from "@/constants/layout";
import ProcessStepper from "@/components/ProcessStepper";
import { api } from "@/services/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Loader from "@/components/Loader";

type FilterMode = "ALL" | "CHANGED" | "UNCHANGED";

function toIssueLabel(value: string): string {
  if (value === "allIssues") return "All issues";
  return value
    .replaceAll(/([A-Z])/g, " $1")
    .replaceAll(/_/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

type PreviewCell = {
  value: unknown;
  old_value: unknown;
  changed: boolean;
};

type PreviewRow = {
  row_id: number;
  account_id?: number;
  changed?: boolean;
  attribution?: string | null;
  data: Record<string, PreviewCell>;
  is_deleted?: boolean;
  deleted?: boolean;
};

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

const DataAnalyticsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");

  // Placeholder (keeps the dropdown functional; analytics preview doesn't currently load issue breakdowns)
  const [selectedIssueType, setSelectedIssueType] =
    useState<string>("allIssues");
  const availableIssueTypes = useMemo(() => [] as string[], []);
  const issueCountByType = useMemo(() => ({}) as Record<string, number>, []);

  const entityStr = sessionStorage.getItem("selectedEntity");

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const sid =
          new URLSearchParams(location.search).get("session_id") ??
          sessionStorage.getItem("session_id");

        if (!sid) {
          navigate("/data-cleaning");
          return;
        }

        const payload = await api.previewCleaned(sid);
        const apiRows: PreviewRow[] = Array.isArray(payload?.rows)
          ? payload.rows
          : [];

        if (!apiRows.length) {
          navigate("/data-cleaning");
          return;
        }

        const dataCols = Object.keys(apiRows[0]?.data ?? {}).filter(
          (h) =>
            h !== "row_id" &&
            h !== "_row_id" &&
            h.toLowerCase() !== "attribution",
        );

        const cols = [...dataCols, "Attribution"];

        if (!cancelled) {
          const deletedRows = (
            Array.isArray(payload?.deleted_rows) ? payload.deleted_rows : []
          ).map((dr: any) => {
            const normalizedData: Record<string, PreviewCell> = {};
            if (dr.data && typeof dr.data === "object") {
              Object.keys(dr.data).forEach((key) => {
                const val = dr.data[key];
                if (
                  val &&
                  typeof val === "object" &&
                  "value" in val &&
                  ("old_value" in val || "changed" in val)
                ) {
                  normalizedData[key] = val;
                } else {
                  normalizedData[key] = {
                    value: null,
                    old_value: val,
                    changed: true,
                  };
                }
              });
            }
            return {
              ...dr,
              is_deleted: true,
              data: normalizedData,
            };
          });

          const allPreppedRows = [...apiRows, ...deletedRows];
          setRows(allPreppedRows);
          setHeaders(cols);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setHeaders([]);
          setLoading(false);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  const isDeletedRow = (row: PreviewRow): boolean => {
    // Check for explicit flags from API
    if (row.is_deleted === true || (row as any).deleted === true) return true;

    const attr = String(row.attribution ?? "").toLowerCase();
    if (
      attr.includes("delete") ||
      attr.includes("deleted") ||
      attr.includes("remove") ||
      attr.includes("removed")
    ) {
      return true;
    }

    const cells = Object.values(row.data ?? {});
    if (!cells.length) return false;

    // Check if ALL cells are marked as changed AND empty (from a previous change)
    return cells.every(
      (c) =>
        c.changed === true &&
        (c.value === null ||
          c.value === undefined ||
          displayValue(c.value) === "") &&
        c.old_value !== null &&
        c.old_value !== undefined,
    );
  };

  const rowDiffMeta = useMemo(() => {
    return rows.map((row, idx) => {
      const deleted = isDeletedRow(row);
      const changedCells = headers.reduce((sum, h) => {
        const cell = row.data?.[h];
        return sum + (cell?.changed ? 1 : 0);
      }, 0);

      const isChanged = deleted || Boolean(row.changed) || changedCells > 0;

      return {
        row,
        idx,
        isDeleted: deleted,
        isChanged,
        changedCells,
      };
    });
  }, [rows, headers]);

  const searchedRows = useMemo(() => {
    if (!search.trim()) return rowDiffMeta;
    const q = search.toLowerCase();

    return rowDiffMeta.filter(({ row }) =>
      headers.some((h) => {
        const cell = row.data?.[h];
        const cur = displayValue(cell?.value).toLowerCase();
        const old = displayValue(cell?.old_value).toLowerCase();
        return cur.includes(q) || old.includes(q);
      }),
    );
  }, [rowDiffMeta, search, headers]);

  const visibleRows = useMemo(() => {
    let result = searchedRows;
    if (filterMode === "CHANGED") {
      result = searchedRows.filter((r) => r.isChanged);
    } else if (filterMode === "UNCHANGED") {
      result = searchedRows.filter((r) => !r.isChanged);
    }

    // Always sort deleted rows to the end
    return [...result].sort((a, b) => {
      if (a.isDeleted && !b.isDeleted) return 1;
      if (!a.isDeleted && b.isDeleted) return -1;
      return 0;
    });
  }, [searchedRows, filterMode]);

  const changedRowsCount = useMemo(
    () => rowDiffMeta.filter((r) => r.isChanged).length,
    [rowDiffMeta],
  );

  const changedCellsCount = useMemo(
    () => rowDiffMeta.reduce((sum, r) => sum + r.changedCells, 0),
    [rowDiffMeta],
  );

  return (
    <>
      <div className={PAGE_OUTER}>
        <div className={PAGE_CONTAINER}>
          <div className="mb-2">
            <ProcessStepper />
          </div>
          <Card className="shadow-lg border border-border bg-card relative !h-[calc(100vh-180px)]">
            <Loader open={loading} inline className="rounded-lg" />
            <CardHeader className="p-1 px-2 bg-muted border-none">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary shadow-sm">
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                  <div className="">
                    <CardTitle className="text-sm font-normal">
                      Data Cleanup Preview
                    </CardTitle>
                    <CardDescription className="text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center text-[11px] font-normal">
                        Changed rows: {changedRowsCount} | Changed cells:{" "}
                        {changedCellsCount}
                      </span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute top-[14px] left-2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-7 text-xs"
                    />
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={`px-2 !h-7 hover:bg-primary/10 ${selectedIssueType !== "allIssues" ? "text-primary  bg-primary/5 " : ""}`}
                        title="Filters"
                      >
                        <Filter className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={8}
                      className="w-56"
                    >
                      {/* <DropdownMenuItem
                        onClick={() => setSelectedIssueType("allIssues")}
                        className={`cursor-pointer hover:text-primary hover:bg-primary/5 ${selectedIssueType === "allIssues" ? "text-primary bg-primary/5" : ""}`}
                      >
                        <span className="flex-1">
                          {toIssueLabel("allIssues")} (
                          {Object.values(issueCountByType || {}).reduce(
                            (acc: number, curr: number) => acc + curr,
                            0,
                          )}
                          )
                        </span>
                        {selectedIssueType === "allIssues" && (
                          <span className="text-primary">✓</span>
                        )}
                      </DropdownMenuItem> */}
                      {/* <DropdownMenuSeparator /> */}

                      <DropdownMenuItem
                        onClick={() => setFilterMode("ALL")}
                        className={`cursor-pointer hover:text-primary hover:bg-primary/5 ${filterMode === "ALL" ? "text-primary bg-primary/5" : ""}`}
                      >
                        <span className="flex-1">All rows</span>
                        {filterMode === "ALL" && (
                          <span className="text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setFilterMode("CHANGED")}
                        className={`cursor-pointer hover:text-primary hover:bg-primary/5 ${filterMode === "CHANGED" ? "text-primary bg-primary/5" : ""}`}
                      >
                        <span className="flex-1">Changed rows</span>
                        {filterMode === "CHANGED" && (
                          <span className="text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setFilterMode("UNCHANGED")}
                        className={`cursor-pointer hover:text-primary hover:bg-primary/5 ${filterMode === "UNCHANGED" ? "text-primary bg-primary/5" : ""}`}
                      >
                        <span className="flex-1">Unchanged rows</span>
                        {filterMode === "UNCHANGED" && (
                          <span className="text-primary">✓</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 relative ">
              <div className=" overflow-hidden">
                <div className="h-[calc(100vh-260px)] overflow-y-auto">
                  <Table className="w-full text-sm">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow>
                        {headers.map((col) => (
                          <TableHead
                            key={col}
                            className="font-normal bg-gray-50 px-3 py-2 text-left whitespace-nowrap border border-border"
                          >
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {visibleRows.map(({ row, isChanged, isDeleted, idx }) => (
                        <TableRow
                          key={`row-${row.row_id ?? idx}`}
                          className={
                            isDeleted
                              ? "bg-red-50 text-red-600"
                              : isChanged
                                ? "bg-amber-50/40"
                                : ""
                          }
                        >
                          {headers.map((col) => {
                            const isAttr = col.toLowerCase() === "attribution";
                            const cell = row.data?.[col];
                            const oldVal = displayValue(cell?.old_value);
                            const newVal = displayValue(cell?.value);
                            const changed = Boolean(cell?.changed);

                            if (isAttr) {
                              const attrRaw =
                                row.attribution ||
                                (row.data as any)?.attribution ||
                                (row.data as any)?.["Attribution"];
                              const attrValue =
                                typeof attrRaw === "object" && attrRaw !== null
                                  ? attrRaw.value || attrRaw.old_value || "—"
                                  : attrRaw || "—";

                              return (
                                <TableCell
                                  key={`${row.row_id}-${col}`}
                                  className={`px-3 py-2 whitespace-nowrap align-top ${isDeleted ? "line-through" : ""}`}
                                >
                                  <span>{attrValue}</span>
                                </TableCell>
                              );
                            }

                            if (isDeleted) {
                              const deletedVal = oldVal || newVal || "—";
                              return (
                                <TableCell
                                  key={`${row.row_id}-${col}`}
                                  className="px-3 py-2 whitespace-nowrap align-top line-through"
                                >
                                  <span>{deletedVal}</span>
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={`${row.row_id}-${col}`}
                                className="px-3 py-2 whitespace-nowrap align-top"
                              >
                                {changed ? (
                                  <div className="inline-flex items-center gap-2 leading-tight">
                                    <span className="text-red-500 line-through">
                                      {oldVal || "—"}
                                    </span>
                                    <span className="font-bold text-green-700">
                                      {newVal || "—"}
                                    </span>
                                  </div>
                                ) : (
                                  <span>{newVal || "—"}</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}

                      {!visibleRows.length && (
                        <TableRow className="h-40">
                          <TableCell
                            colSpan={Math.max(headers.length, 1)}
                            className="p-6 text-center text-muted-foreground "
                          >
                            <span className=" p-6 bg-red-400 border-2 border-red-500 mt-4 opacity-40 text-white max-w-[200px] rounded-md">
                              {" "}
                              No rows found.
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
            <div className="flex flex-col sm:flex-row justify-between p-2 border-t bg-muted">
              <Button
                variant="outline"
                className="px-4 font-semibold border-primary text-primary hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                onClick={() => navigate("/data-cleaning")}
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

              <Button
                variant="outline"
                className="px-5 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                onClick={() => {
                  const total = rows.length;
                  const updated = changedRowsCount;
                  const unchanged = Math.max(0, total - updated);
                  const stats: ImportStats = getDefaultImportStats();
                  const totalFields = Math.max(0, total * headers.length);
                  stats.total_processed = { rows: total, fields: totalFields };
                  stats.records_affected = {
                    rows: updated,
                    rows_pct: total ? (updated / total) * 100 : 0,
                    fields: changedCellsCount,
                    fields_pct: totalFields
                      ? (changedCellsCount / totalFields) * 100
                      : 0,
                  };
                  stats.updated = {
                    description: entityStr ?? "",
                    fields: changedCellsCount,
                    total_fields: totalFields,
                    pct: totalFields
                      ? (changedCellsCount / totalFields) * 100
                      : 0,
                  };
                  stats.unchanged_data = {
                    description: "",
                    rows: unchanged,
                    total_rows: total,
                    pct: total ? (unchanged / total) * 100 : 0,
                  };
                  sessionStorage.setItem(
                    IMPORT_STATS_KEY,
                    JSON.stringify(stats),
                  );
                  navigate("/complete");
                }}
              >
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
        {/* Navigation Arrows */}
        <button
          onClick={() => navigate("/data-cleaning")}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 p-3  transition-all duration-200 px-1 rounded-md bg-black opacity-40 text-white shadow-lg"
          title="Previous: Data Cleaning"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          onClick={() => {
            const total = rows.length;
            const updated = changedRowsCount;
            const unchanged = Math.max(0, total - updated);

            const stats: ImportStats = getDefaultImportStats();
            const totalFields = Math.max(0, total * headers.length);
            stats.total_processed = { rows: total, fields: totalFields };
            stats.records_affected = {
              rows: updated,
              rows_pct: total ? (updated / total) * 100 : 0,
              fields: changedCellsCount,
              fields_pct: totalFields
                ? (changedCellsCount / totalFields) * 100
                : 0,
            };
            stats.updated = {
              description: entityStr ?? "",
              fields: changedCellsCount,
              total_fields: totalFields,
              pct: totalFields ? (changedCellsCount / totalFields) * 100 : 0,
            };
            stats.unchanged_data = {
              description: "",
              rows: unchanged,
              total_rows: total,
              pct: total ? (unchanged / total) * 100 : 0,
            };
            sessionStorage.setItem(IMPORT_STATS_KEY, JSON.stringify(stats));
            navigate("/complete");
          }}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 p-3 transition-all duration-200 disabled:opacity-50 rounded-md bg-black opacity-40  text-white shadow-lg px-1"
          title="Next: Complete"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </>
  );
};

export default DataAnalyticsPage;
