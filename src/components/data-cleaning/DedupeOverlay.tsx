import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  DedupeCondition,
  DedupeMode,
  DedupeMethod,
  DedupeKeepStrategy,
  DrawerType,
  KeepRemove,
  PreviewRow,
} from "./types";

type Props = {
  drawer: DrawerType;
  previewOpen: boolean;
  setDrawer: (v: DrawerType) => void;
  setPreviewOpen: (v: boolean) => void;
  previewColumns: string[];
  previewRows: PreviewRow[];
  displayValue: (v: unknown) => string;

  dedupeError: string | null;
  dedupeMode: DedupeMode;
  setDedupeMode: (v: DedupeMode) => void;
  duplicateIndicatorCount: number;
  ignoreCase: boolean;
  setIgnoreCase: (v: boolean) => void;
  ignoreWhitespace: boolean;
  setIgnoreWhitespace: (v: boolean) => void;
  dedupeColumns: string[];
  setDedupeColumns: (updater: (prev: string[]) => string[]) => void;
  columnPickerValue: string;
  setColumnPickerValue: (v: string) => void;
  columns: string[];
  keepRemove: KeepRemove;
  setKeepRemove: (v: KeepRemove) => void;
  conditions: DedupeCondition[];
  setConditions: (
    updater: (prev: DedupeCondition[]) => DedupeCondition[],
  ) => void;
  previewLoading: boolean;
  applyDedupLoading: boolean;
  onBuildPreview: () => Promise<void> | void;
  onRemoveDuplicates: () => Promise<void> | void;
  flagDuplicates: boolean;
  setFlagDuplicates: (v: boolean) => void;
  dedupeMethod: DedupeMethod;
  setDedupeMethod: (v: DedupeMethod) => void;
  dedupeKeepStrategy: DedupeKeepStrategy;
  setDedupeKeepStrategy: (v: DedupeKeepStrategy) => void;
};

export default function DedupeOverlay(props: Props) {
  const {
    drawer,
    previewOpen,
    setDrawer,
    setPreviewOpen,
    previewColumns,
    previewRows,
    displayValue,
    dedupeError,
    dedupeMode,
    setDedupeMode,
    duplicateIndicatorCount,
    ignoreCase,
    setIgnoreCase,
    ignoreWhitespace,
    setIgnoreWhitespace,
    dedupeColumns,
    setDedupeColumns,
    columnPickerValue,
    setColumnPickerValue,
    columns,
    keepRemove,
    setKeepRemove,
    conditions,
    setConditions,
    previewLoading,
    applyDedupLoading,
    onBuildPreview,
    onRemoveDuplicates,
    flagDuplicates,
    setFlagDuplicates,
    dedupeMethod,
    setDedupeMethod,
    dedupeKeepStrategy,
    setDedupeKeepStrategy,
  } = props;

  const [renderDrawer, setRenderDrawer] = useState(Boolean(drawer));
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [lastDrawer, setLastDrawer] = useState<DrawerType>(drawer);

  useEffect(() => {
    if (drawer) {
      setLastDrawer(drawer);
      setDrawerVisible(false);
      setRenderDrawer(true);
      const timeoutId = window.setTimeout(() => setDrawerVisible(true), 10);
      return () => window.clearTimeout(timeoutId);
    }

    if (!renderDrawer) return;
    setDrawerVisible(false);
    const timeoutId = window.setTimeout(() => setRenderDrawer(false), 300);
    return () => window.clearTimeout(timeoutId);
  }, [drawer, renderDrawer]);

  useEffect(() => {
    if (drawer || previewOpen || renderDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer, previewOpen, renderDrawer]);

  if (!(drawer || previewOpen || renderDrawer)) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/25"
        onClick={() => {
          setDrawer(null);
          setPreviewOpen(false);
        }}
      />
      {previewOpen && (
        <div
          className="absolute left-4 top-4 bottom-4 bg-white border border-border rounded shadow-2xl overflow-hidden transition-all duration-300"
          style={{ right: renderDrawer ? "580px" : "4%" }}
        >
          <div className="h-10 px-6 bg-white border-b border-border flex items-center justify-between">
            <h2 className="text-xl leading-none font-light text-foreground">
              Preview
            </h2>
            <button onClick={() => setPreviewOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-0 px-4 h-[calc(100%-40px)] overflow-auto">
            <Table className="min-w-full text-sm ">
              <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                <TableRow>
                  {previewColumns.map((c) => (
                    <TableHead
                      key={c}
                      className="px-3 py-2 border-b text-left uppercase tracking-wide text-muted-foreground whitespace-nowrap bg-muted "
                    >
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r, i) => {
                  const isAffected = r.row?.dedup_flag === "affected";
                  let rowClass = flagDuplicates
                    ? r.shaded
                      ? "bg-red-50 hover:bg-red-100"
                      : "bg-white hover:bg-gray-50"
                    : "odd:bg-background even:bg-primary/10";

                  if (flagDuplicates && isAffected) {
                    rowClass = "bg-red-100 hover:bg-red-200";
                  }
                  return (
                    <TableRow
                      key={String(r.rowIndex) + "-" + String(i)}
                      className={`${rowClass} h-8`}
                    >
                      {previewColumns.map((c) => (
                        <TableCell
                          key={String(r.rowIndex) + "-" + c}
                          className="px-3 py-2 border-b whitespace-nowrap"
                        >
                          {displayValue(r.row[c]) || "NULL"}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {!previewRows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(previewColumns.length, 1)}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No duplicate rows found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {renderDrawer && (
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-border shadow-2xl z-10 transition-transform duration-300 ease-in-out ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="h-12 px-6 border-b border-border bg-muted flex items-center justify-between">
            <h2 className="flex items-center text-md leading-none font-light text-foreground">
              <span className="mr-2">
                <Copy className="h-4 w-4" />
              </span>
              <span>
                {lastDrawer === "dedupe"
                  ? dedupeMode === "column"
                    ? "Deduplicate"
                    : "Deduplicate"
                  : "Fix Addresses"}
              </span>
            </h2>
            <button
              onClick={() => setDrawer(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-sm">
            {lastDrawer === "dedupe" && (
              <>
                {dedupeError && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">
                    {dedupeError}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      className="accent-blue-600"
                      type="radio"
                      checked={dedupeMode === "column"}
                      onChange={() => setDedupeMode("column")}
                    />{" "}
                    Column wise
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      className="accent-blue-600"
                      type="radio"
                      checked={dedupeMode === "row"}
                      onChange={() => setDedupeMode("row")}
                    />{" "}
                    Row wise
                  </label>
                  {duplicateIndicatorCount > 0 && (
                    <div className="ml-auto text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-1.5 text-sm font-medium">
                      {duplicateIndicatorCount} duplicate{" "}
                      {dedupeMode === "column" ? "columns" : "rows"} found
                    </div>
                  )}
                </div>

                {dedupeMode === "column" && (
                  <div className=" rounded-lg  space-y-2">
                    <div className="relative">
                      <p className="text-sm text-muted-foreground mb-2">
                        Select Columns
                      </p>

                      <select
                        className="w-full h-11 border border-border rounded-md px-3 bg-background text-sm"
                        value={columnPickerValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setColumnPickerValue("");
                          if (!v) return;
                          setDedupeColumns((prev) =>
                            prev.includes(v) ? prev : [...prev, v],
                          );
                        }}
                      >
                        <option value="">
                          Select columns to View/Remove Duplicates
                        </option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {dedupeColumns.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-muted text-sm"
                        >
                          {c}
                          <button
                            onClick={() =>
                              setDedupeColumns((prev) =>
                                prev.filter((x) => x !== c),
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {dedupeMode === "column" && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Select method
                      </p>
                      <select
                        className="w-full h-11 border border-border rounded-md px-3 bg-background text-sm"
                        value={dedupeMethod}
                        onChange={(e) =>
                          setDedupeMethod(e.target.value as DedupeMethod)
                        }
                      >
                        <option value="automatic">Automatic</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>

                    {dedupeMethod === "manual" && (
                      <div className="space-y-4">
                        <p className="text-sm font-medium flex items-center">
                          Enter conditions to select which rows to
                          <label className="ml-3 mr-3 inline-flex items-center gap-2 text-sm font-normal">
                            <input
                              type="radio"
                              checked={keepRemove === "keep"}
                              onChange={() => setKeepRemove("keep")}
                            />{" "}
                            Keep
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-normal">
                            <input
                              type="radio"
                              checked={keepRemove === "remove"}
                              onChange={() => setKeepRemove("remove")}
                            />{" "}
                            Remove
                          </label>
                        </p>

                        {conditions.map((cond, idx) => (
                          <div
                            key={"cond-" + String(idx)}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm shrink-0">if</span>
                            <select
                              className="h-11 flex-1 min-w-[120px] border border-border rounded-md px-3 bg-background text-sm"
                              value={cond.column}
                              onChange={(e) =>
                                setConditions((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, column: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                            >
                              {columns.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-11 flex-1 min-w-[120px] border border-border rounded-md px-3 bg-background text-sm"
                              value={cond.operator}
                              onChange={(e) =>
                                setConditions((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          operator: e.target
                                            .value as DedupeCondition["operator"],
                                        }
                                      : p,
                                  ),
                                )
                              }
                            >
                              <option value="is">Is</option>
                              <option value="is_not">Is not</option>
                              <option value="contains">Contains</option>
                              <option value="starts_with">Starts with</option>
                              <option value="ends_with">Ends with</option>
                              <option value="greater_than">Greater than</option>
                              <option value="less_than">Less than</option>
                            </select>
                            <Input
                              className="h-11 flex-1 min-w-[120px] text-sm"
                              value={cond.value}
                              onChange={(e) =>
                                setConditions((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, value: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 shrink-0"
                              onClick={() =>
                                setConditions((prev) => [
                                  ...prev,
                                  {
                                    column: columns[0] || "",
                                    operator: "is",
                                    value: "",
                                  },
                                ])
                              }
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                            {conditions.length > 1 && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 shrink-0"
                                onClick={() =>
                                  setConditions((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">
                    Options
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={ignoreCase}
                        onChange={(e) => setIgnoreCase(e.target.checked)}
                      />{" "}
                      Ignore case
                    </label>
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={ignoreWhitespace}
                        onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                      />{" "}
                      Ignore whitespace
                    </label>
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={flagDuplicates}
                        onChange={(e) => setFlagDuplicates(e.target.checked)}
                      />{" "}
                      Flag duplicate records
                    </label>
                  </div>
                </div>

                {dedupeMethod === "automatic" &&
                  dedupeMode === "column" &&
                  duplicateIndicatorCount > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2 text-muted-foreground">Keep strategy</p>
                      <div className="flex flex-wrap gap-4 text-sm mt-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="keep_strategy"
                            checked={dedupeKeepStrategy === "oldest"}
                            onChange={() => setDedupeKeepStrategy("oldest")}
                            className="text-primary h-4 w-4"
                          />{" "}
                          Oldest
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="keep_strategy"
                            checked={dedupeKeepStrategy === "latest"}
                            onChange={() => setDedupeKeepStrategy("latest")}
                            className="text-primary h-4 w-4"
                          />{" "}
                          Latest
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name="keep_strategy"
                            checked={dedupeKeepStrategy === "max_filled"}
                            onChange={() => setDedupeKeepStrategy("max_filled")}
                            className="text-primary h-4 w-4"
                          />{" "}
                          Maximum filled
                        </label>
                      </div>
                    </div>
                  )}

                <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-muted p-4 py-2 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDrawer(null);
                      setPreviewOpen(false);
                    }}
                    className="h-9 text-xs px-5"
                    disabled={previewLoading || applyDedupLoading}
                  >
                    Cancel
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void onRemoveDuplicates()}
                      disabled={previewLoading || applyDedupLoading}
                      className="border-red-400 text-red-400 hover:text-red-400 hover:bg-red-100 h-9 text-xs px-5"
                    >
                      {applyDedupLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Remove Duplicates
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void onBuildPreview()}
                      disabled={previewLoading || applyDedupLoading}
                      className="bg-white text-primary border-primary hover:bg-blue-100 h-9 text-xs px-5"
                    >
                      {previewLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Preview
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
