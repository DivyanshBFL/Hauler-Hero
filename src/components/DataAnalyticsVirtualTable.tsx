import { useEffect, useMemo } from "react";
// @ts-ignore
import { List } from "react-window";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

const DEFAULT_COLUMN_WIDTH = 180;

type Props = {
  csvData: any[];
  headers: string[];
  matchKey: string;
  newRowMap: Map<string, boolean>;
  duplicateMap: Map<string, boolean>;
  updatedRowDiffMap: Map<string, Record<string, any>>;
  originalRowMap: Map<string, any>;
  height?: number;
  rowHeight?: number;
  columnWidth?: number;
  onReady?: () => void;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
};

type RowPropsFromList = {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: string };
};

type RowPropsPassed = {
  csvData: any[];
  headers: string[];
  matchKey: string;
  newRowMap: Map<string, boolean>;
  updatedRowDiffMap: Map<string, Record<string, any>>;
  originalRowMap: Map<string, any>;
  columnWidth: number;
  totalRowWidth: number;
  rowHeight: number;
};

function TableRow({
  index,
  style,
  csvData,
  headers,
  matchKey,
  newRowMap,
  updatedRowDiffMap,
  originalRowMap,
  columnWidth,
  totalRowWidth,
  rowHeight,
}: Readonly<RowPropsFromList & RowPropsPassed>) {
  const row = csvData[index];
  if (!row) return null;

  const isNew = newRowMap.has(row[matchKey]);

  const isCellUpdated = (r: any, field: string) => {
    const diff = updatedRowDiffMap.get(r[matchKey]);
    return diff ? field in diff : false;
  };

  return (
    <div
      className={cn(
        "flex items-stretch border-b border-border transition-colors hover:bg-muted/50 text-foreground shrink-0",
        isNew && "bg-primary/10 hover:bg-primary/15"
      )}
      style={{
        ...style,
        width: totalRowWidth,
        minWidth: totalRowWidth,
        height: rowHeight,
        minHeight: rowHeight,
        display: "flex",
      }}
    >
      {headers.map((field) => {
        const updated = !isNew && isCellUpdated(row, field);
        const originalRow = originalRowMap.get(row[matchKey]);
        const previousValue = originalRow ? originalRow[field] : "N/A";
        const cellValue = row[field] != null ? String(row[field]) : "";

        return (
          <div
            className={cn(
              "px-3 py-2 text-sm flex items-center border-r border-border last:border-r-0 shrink-0 overflow-hidden",
              updated && "bg-destructive/10 text-destructive font-medium"
            )}
            key={field}
            style={{
              width: columnWidth,
              minWidth: columnWidth,
              height: "100%",
            }}
            title={cellValue}
          >
            <span className="truncate block" title={cellValue}>
              {cellValue}
              {updated && (
                <span className="text-xs line-through text-muted-foreground ml-1" title={String(previousValue)}>
                  {String(previousValue)}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const VirtualizedCsvTable = ({
  csvData,
  headers,
  matchKey,
  newRowMap,
  duplicateMap,
  updatedRowDiffMap,
  originalRowMap,
  height = 600,
  rowHeight = 30,
  columnWidth = 160,
  onReady,
  sortConfig,
  onSort
}: Props) => {
  const totalRowWidth = headers.length * columnWidth;

  useEffect(() => {
    if (csvData.length > 0) {
      onReady?.();
    }
  }, [csvData.length, onReady]);

  const rowProps: RowPropsPassed = useMemo(
    () => ({
      csvData,
      headers,
      matchKey,
      newRowMap,
      updatedRowDiffMap,
      originalRowMap,
      columnWidth,
      totalRowWidth,
      rowHeight,
    }),
    [
      csvData,
      headers,
      matchKey,
      newRowMap,
      updatedRowDiffMap,
      originalRowMap,
      columnWidth,
      totalRowWidth,
      rowHeight,
    ]
  );

  const tableContentWidth = Math.max(totalRowWidth, 320);
  const isCellUpdated = (row: any, field: string) => {
    const diff = updatedRowDiffMap.get(row[matchKey]);
    return diff ? field in diff : false;
  };


  const Header = () => (
    <div
      className="w-full flex sticky top-0 z-10 bg-muted/50 dark:bg-slate-900/90 border-b dark:border-slate-800 font-medium text-muted-foreground dark:text-slate-200 items-center backdrop-blur-sm"
      style={{
        display: "flex",
        height: rowHeight,
        minHeight: rowHeight,
      }}
    >
      {headers.map(h => {
        const isSorted = sortConfig?.key === h;
        const isAsc = sortConfig?.direction === 'asc';

        return (
          <div
            className={cn(
              "flex-1 px-4 text-left align-middle font-medium text-muted-foreground dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis text-sm flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors select-none",
              isSorted && "text-foreground font-semibold"
            )}
            key={h}
            onClick={() => onSort?.(h)}
          >
            {h}
            {isSorted ? (
              isAsc ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </div>
        );
      })}
    </div>
  );

  //  Row
  const Row = ({ index, style }: any) => {
    const row = csvData[index];
    const key = row[matchKey];
    const isNew = newRowMap.has(key);
    const isDuplicate = duplicateMap.has(key);


    return (
      <div
        className={cn(
          "w-full flex items-center border-b dark:border-slate-800 transition-colors hover:bg-muted/50 dark:hover:bg-slate-800/50 data-[state=selected]:bg-muted dark:text-slate-300",
          isNew && "bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-100",
          isDuplicate && "bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-100"
        )}
        style={{
          ...style,
          display: "flex",
        }}
      >
        {headers.map(field => {
          const updated = !isNew && isCellUpdated(row, field);
          const originalRow = originalRowMap.get(key);
          const previousValue = originalRow ? originalRow[field] : "N/A";

          return <div
            className={cn(
              "flex-1 px-4 py-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis flex items-center",
              updated && "bg-orange-200 dark:bg-orange-900/40 dark:text-orange-100 font-medium text-orange-900 gap-2"
            )}
            key={field}
            style={{
              width: columnWidth,
              height: "100%",
            }}
          >
            {row[field] + "  "}<span className="text-xs line-through opacity-70">  {updated && previousValue}</span>
          </div>;


        })}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border border-border shadow-none bg-card flex flex-col">
      {/* Single horizontal scroll: only this wrapper scrolls horizontally. List handles vertical scroll only. */}
      <div className="overflow-x-auto overflow-y-hidden flex flex-col min-h-0" style={{ maxHeight: rowHeight + height }}>
        <div style={{ width: tableContentWidth, minWidth: "100%" }}>
          <div
            className="flex bg-muted border-b border-border font-medium text-muted-foreground items-center shrink-0"
            style={{
              height: rowHeight,
              minHeight: rowHeight,
              width: totalRowWidth,
              minWidth: totalRowWidth,
            }}
          >
            {headers.map((h) => (
              <div
                className="px-3 py-2 text-left text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis shrink-0 border-r border-border last:border-r-0"
                key={h}
                style={{
                  width: columnWidth,
                  minWidth: columnWidth,
                }}
                title={h}
              >
                {h}
              </div>
            ))}
          </div>

          <List
            rowCount={csvData.length}
            rowHeight={rowHeight}
            rowComponent={TableRow}
            rowProps={rowProps as any}
            style={{
              height: height,
              width: totalRowWidth,
              overflowX: "hidden",
            }}
          />
        </div>
      </div>
    </Card>
  );
};

export default VirtualizedCsvTable;

