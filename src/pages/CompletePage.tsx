import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Check,
  Circle,
  Database,
  Download,
  GitMerge,
  TrendingUp,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { type ImportStats } from "@/types/importStats";
import { PAGE_CONTAINER, PAGE_OUTER } from "@/constants/layout";
import { api } from "@/services/api";
import ProcessStepper from "@/components/ProcessStepper";
import Loader from "@/components/Loader";

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  className = "",
}: {
  label: string;
  value: number | string;
  detail?: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-2 h-[86px] !bg-slate-100 !border-slate-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] leading-none text-slate-800 font-medium">
          {label}
        </span>
        <div className="rounded-md bg-white/60 p-1">
          <Icon className="h-3.5 w-3.5 text-slate-600" />
        </div>
      </div>
      <div className="mt-1.5">
        <div className="text-[24px] mb-1 leading-none font-bold tabular-nums text-slate-900">
          {value}
        </div>
        {detail ? (
          <div className="text-[10px] text-slate-700 mt-0.5 leading-none">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CompletePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ImportStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionId = sessionStorage.getItem("session_id");
        if (!sessionId) throw new Error("Session ID is missing");
        const summaryData = await api.fetchSummaryData(sessionId);
        setStats(summaryData);
      } catch (error) {
        console.error("Error loading summary data:", error);
      }
    };

    fetchData();
  }, []);

  const handleStartOver = () => {
    sessionStorage.clear();
    navigate("/upload");
  };

  const handleDownloadProcessedFile = async () => {
    try {
      const sessionId = sessionStorage.getItem("session_id");
      if (!sessionId) throw new Error("Session ID is missing");
      const blob = await api.exportCleanedData(sessionId);
      const url = globalThis.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cleaned_data.csv";
      link.click();
      globalThis.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting cleaned data:", error);
    }
  };

  const apiStats = stats as Partial<ImportStats> | null;
  const rawStats = stats as Record<string, any> | null;
  const hasNum = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const toNum = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const formatPct = (value: number) => `${Math.round(value)}%`;

  const metricTiles = [
    toNum(apiStats?.total_processed?.rows) !== null
      ? {
          key: "total-processed",
          label: "Upload Data",
          value: toNum(apiStats?.total_processed?.rows)!.toLocaleString(),
          detail: "Rows Processed",
          icon: Database,
          className: "!bg-emerald-200 !border-emerald-300",
        }
      : null,
    toNum(apiStats?.records_affected?.rows) !== null
      ? {
          key: "Field-mapping",
          label: "Field Mapping",
          value: toNum(apiStats?.mapped_data?.mapped_cols ?? 0)!.toLocaleString(),
          detail: "Fields Auto Mapped",
          icon: GitMerge,
          className: "",
        }
      : null,
    toNum(apiStats?.success_rate?.pct) !== null
      ? {
          key: "success-rate",
          label: "Data Cleaning",
          value: toNum(apiStats?.updated?.fields ?? 0)!.toLocaleString(),
          detail: "Issues Fixed",
          icon: TrendingUp,
          className: "!bg-amber-200 !border-amber-300",
        }
      : null,
    toNum(apiStats?.mapped_data?.mapped_cols) !== null &&
    toNum(apiStats?.mapped_data?.total_cols) !== null
      ? {
          key: "mapped-cols",
          label: "Data Cleaning",
          value: toNum(apiStats?.duplicate_findings?.rows_removed ?? 0)!.toLocaleString(),
          detail: "Duplicate(s) Removed",
          // toNum(apiStats?.mapped_data?.cols_pct) !== null
          //   ? formatPct(toNum(apiStats?.mapped_data?.cols_pct)!)
          //   : undefined,
          icon: WandSparkles,
          className: "!bg-lime-200 !border-lime-300",
        }
      : null,
    hasNum(rawStats?.inserted?.rows)
      ? {
          key: "inserted",
          label: "Inserted",
          value: (rawStats.inserted.rows as number).toLocaleString(),
          detail: hasNum(rawStats?.inserted?.pct)
            ? formatPct(rawStats.inserted.pct as number)
            : undefined,
          icon: WandSparkles,
          className: "!bg-lime-200 !border-lime-300",
        }
      : null,
    hasNum(rawStats?.updated?.rows)
      ? {
          key: "updated",
          label: "Updated",
          value: (rawStats.updated.rows as number).toLocaleString(),
          detail: hasNum(rawStats?.updated?.rows_pct)
            ? formatPct(rawStats.updated.rows_pct as number)
            : hasNum(rawStats?.updated?.pct)
              ? formatPct(rawStats.updated.pct as number)
              : undefined,
          icon: TrendingUp,
          className: "!bg-fuchsia-200 !border-fuchsia-300",
        }
      : null,
    toNum(apiStats?.unchanged_data?.rows) !== null
      ? {
          key: "unchanged",
          label: "Data Cleaning",
          value:toNum(apiStats?.success_rate?.ai_fixed_fields ?? 0)!.toLocaleString(),
          detail: "Fields Auto Corrected ",
          icon: Circle,
          className: "!bg-sky-200 !border-sky-300",
        }
      : null,
    toNum(apiStats?.duplicate_findings?.rows_removed) !== null
      ? {
          key: "duplicates",
          label: "Data Cleaning",
          value:
            toNum(
              apiStats?.duplicate_findings?.rows_removed,
            )!.toLocaleString(),
          detail: "Address Correction ",
          icon: Circle,
          className: "!bg-rose-200 !border-rose-300",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: string;
    detail?: string;
    icon: React.ElementType;
    className: string;
  }>;
  const metricTilesForRow = [...metricTiles];
  while (metricTilesForRow.length < 6) {
    metricTilesForRow.push({
      key: `placeholder-${metricTilesForRow.length}`,
      label: "N/A",
      value: "0",
      detail: "No data",
      icon: Circle,
      className: "!bg-slate-100 !border-slate-200",
    });
  }

  const actionBreakdown = [
    hasNum(rawStats?.inserted?.rows)
      ? {
          key: "inserted",
          label: "Inserted",
          rows: rawStats.inserted.rows as number,
          pct: hasNum(rawStats?.inserted?.pct)
            ? (rawStats.inserted.pct as number)
            : undefined,
          color: "bg-blue-500",
          dotColor: "text-blue-500",
          hex: "#3b82f6",
        }
      : null,
    hasNum(rawStats?.updated?.rows)
      ? {
          key: "updated",
          label: "Updated",
          rows: rawStats.updated.rows as number,
          pct: hasNum(rawStats?.updated?.rows_pct)
            ? (rawStats.updated.rows_pct as number)
            : hasNum(rawStats?.updated?.pct)
              ? (rawStats.updated.pct as number)
              : undefined,
          color: "bg-amber-500",
          dotColor: "text-amber-500",
          hex: "#f59e0b",
        }
      : null,
    hasNum(apiStats?.unchanged_data?.rows)
      ? {
          key: "unchanged",
          label: "Unchanged",
          rows: apiStats.unchanged_data.rows,
          pct: hasNum(apiStats?.unchanged_data?.pct)
            ? apiStats.unchanged_data.pct
            : undefined,
          color: "bg-slate-400",
          dotColor: "text-slate-400",
          hex: "#94a3b8",
        }
      : null,
    hasNum(apiStats?.duplicate_findings?.rows_removed)
      ? {
          key: "duplicates",
          label: "Duplicates",
          rows: apiStats.duplicate_findings.rows_removed,
          pct: hasNum(apiStats?.duplicate_findings?.pct)
            ? apiStats.duplicate_findings.pct
            : undefined,
          color: "bg-rose-500",
          dotColor: "text-rose-500",
          hex: "#f43f5e",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    rows: number;
    pct?: number;
    color: string;
    dotColor: string;
    hex: string;
  }>;
  const totalActionRows =
    hasNum(apiStats?.total_processed?.rows) && apiStats.total_processed.rows > 0
      ? apiStats.total_processed.rows
      : actionBreakdown.reduce((sum, item) => sum + item.rows, 0);

  const actionBreakdownWithPct = actionBreakdown.map((item) => ({
    ...item,
    computedPct:
      hasNum(item.pct) && item.pct >= 0
        ? item.pct
        : totalActionRows > 0
          ? (item.rows / totalActionRows) * 100
          : 0,
  }));
  const pieData = actionBreakdownWithPct.filter((item) => item.computedPct > 0);
  const pieBackground =
    pieData.length > 0
      ? `conic-gradient(${pieData
          .map((item, index) => {
            const start = pieData
              .slice(0, index)
              .reduce((sum, current) => sum + current.computedPct, 0);
            const end = start + item.computedPct;
            return `${item.hex} ${start}% ${end}%`;
          })
          .join(", ")})`
      : "#e5e7eb";

  const importDate = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <div className={PAGE_OUTER}>
        <div className={PAGE_CONTAINER}>
          <div className="mb-2">
            <ProcessStepper />
          </div>
          <Card className="shadow-none border border-border bg-card animate-in overflow-hidden">
            <Loader open={!stats} />

            <CardContent className="p-2 space-y-4">
              <div >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-3 md:p-4">
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-white border border-emerald-200 text-emerald-600">
                        <Check className="h-8 w-8" strokeWidth={2.5} />
                      </div>
                      <h1 className="text-xl font-bold text-emerald-600 leading-none">
                        Success!
                      </h1>
                      <p className="text-sm text-slate-500">
                        Import completed. Review the summary below.
                      </p>
                      <div className="text-sm text-slate-600 mt-0.5 flex gap-2 items-center">
                        <span className="font-medium">Entity:</span> Account 
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 inline" />
                        <span>{importDate}</span>
                          </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {/* <Calendar className="h-3 w-3" />
                        <span>{importDate}</span> */}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 md:p-4">
                    <h2 className="text-xl leading-7 font-semibold text-slate-800 mb-3">
                      Quick Summary
                    </h2>
                    <ul className="space-y-1.5 ">
                      {stats?.textual_summary?.filter(Boolean)
                        .map((text) => (
                          <li
                            key={String(text)}
                            className="flex items-start gap-3 text-[13px] leading-relaxed text-slate-700"
                          >
                            <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                            <span>{text}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>

              <section>
                <h2 className="text-sm font-medium text-slate-800 mb-1.5">
                  Key metrics
                </h2>
                <div className="!grid !grid-cols-6 gap-1.5 [&>*]:min-w-0">
                  {metricTilesForRow.slice(0, 6).map((tile) => (
                    <StatTile
                      key={tile.key}
                      label={tile.label}
                      value={tile.value}
                      detail={tile.detail}
                      icon={tile.icon}
                      className={tile.className}
                    />
                  ))}
                </div>
              </section>

              {actionBreakdownWithPct.length > 0 ? (
                <>
                  {/* <div className="rounded-lg bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                      <div className="flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                        Distribution
                      </div>
                      {actionBreakdownWithPct.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <span className="inline-flex items-center gap-2 text-slate-700">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${item.color}`}
                            />
                            {item.label}
                          </span>
                          <span className="text-slate-600">
                            {formatPct(item.computedPct)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div> */}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <h3 className="text-base font-semibold text-slate-800 mb-2">
                        Record breakdown
                      </h3>
                      <div className="flex items-center gap-4">
                        <div
                          className="h-28 w-28 rounded-full relative shrink-0"
                          style={{ background: pieBackground }}
                        >
                          <div className="absolute inset-[14px] rounded-full bg-white" />
                        </div>
                        <div className="space-y-2.5 flex-1">
                          {actionBreakdownWithPct.map((item) => (
                            <div
                              key={`${item.key}-breakdown`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="inline-flex items-center gap-2 text-slate-700">
                                <Circle
                                  className={`h-3.5 w-3.5 fill-current ${item.dotColor}`}
                                />
                                {item.label}
                              </span>
                              <span className="font-medium tabular-nums">
                                {item.rows.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <h3 className="text-base font-semibold text-slate-800 mb-2">
                        By action
                      </h3>
                      <div className="space-y-2">
                        {actionBreakdownWithPct.map((item) => (
                          <div key={`${item.key}-bar`} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm text-slate-700">
                              <span>{item.label}</span>
                              <span className="tabular-nums">
                                {item.rows.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2.5 rounded-md bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full ${item.color}`}
                                style={{
                                  width: `${Math.max(2, Math.min(100, item.computedPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <h3 className="text-base font-semibold text-slate-800 mb-2">
                        Outcome overview
                      </h3>
                      <div className="h-[10px] rounded-md bg-slate-100 overflow-hidden flex">
                        {actionBreakdownWithPct.map((item) => (
                          <div
                            key={`${item.key}-stack`}
                            className={item.color}
                            style={{
                              width: `${Math.max(2, Math.min(100, item.computedPct))}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700">
                        {actionBreakdownWithPct.map((item) => (
                          <span
                            key={`${item.key}-legend`}
                            className="tabular-nums"
                          >
                            {formatPct(item.computedPct)} {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>

            <div className="flex justify-end gap-3 p-2 border-t bg-muted">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="px-5 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors"
              >
                <UploadCloud className="h-4 w-4 mr-2" />
                Process Another File
              </Button>
              <Button
                onClick={handleDownloadProcessedFile}
                className="px-5 font-semibold"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Cleaned Data
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
