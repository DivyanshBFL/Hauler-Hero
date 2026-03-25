import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  TrendingUp,
  PlusCircle,
  RefreshCw,
  Copy,
  Calendar,
  Percent,
  Activity,
  Download,
  UploadCloud,
  Loader2,
  BrushCleaning,
  ListChecks,
} from "lucide-react";
import { getDefaultImportStats, type ImportStats } from "@/types/importStats";
import { PAGE_OUTER, PAGE_CONTAINER } from "@/constants/layout";
import { api } from "@/services/api";

function MetricCard({
  label,
  value,
  icon: Icon,
  subtext,
  className = "",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtext?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-6 flex flex-col justify-between shadow-sm transition-all hover:shadow-md h-40 ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </span>
        <div className="p-2 rounded-lg bg-white/50">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold tabular-nums tracking-tight">
          {value}
        </div>
        {subtext ? (
          <div className="text-sm font-medium text-muted-foreground/70 mt-1">
            {subtext}
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cleaned_data.csv"; // or .json depending on existing API behavior
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting cleaned data:", error);
    }
  };

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading Statistics</p>
        </div>
      </div>
    );
  }

  const s = stats ?? getDefaultImportStats();
  const importDate = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className={`${PAGE_OUTER} min-h-80`}>
      <div className={PAGE_CONTAINER}>
        <Card className="shadow-none border border-border bg-card animate-in overflow-hidden ">
          <CardContent className="p-8 space-y-8">
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-border p-8 shadow-sm flex flex-col md:flex-row gap-10 items-start md:items-center">
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-green-400 text-white shadow-xl">
                      <Check className="h-10 w-10 font-bold" strokeWidth={4} />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-slate-900 leading-none">
                        Success!
                      </h1>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 font-medium tracking-wide">
                        <Calendar className="h-3 w-3" />
                        <span>Processed on {importDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block h-24 w-px bg-slate-100/80 shrink-0" />

                <div className="space-y-4 flex-1">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Quick Summary
                  </h2>

                  <ul className="grid grid-cols-1 gap-x-6 gap-y-3">
                    {[
                      `Your CSV was uploaded and parsed into ${s.total_processed.rows.toLocaleString()} records.`,
                      "Source columns were mapped to the target entity; data was transformed accordingly.",
                      "Each record was compared: new ones inserted, existing updated.",
                      "Data has been loaded into the system and is ready to use.",
                    ].map((text, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-4 text-[13px] leading-relaxed text-slate-600 font-medium"
                      >
                        <div className="mt-1 h-5 w-5 shrink-0 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                          <Check className="h-2.5 w-2.5" strokeWidth={5} />
                        </div>
                        <span className="opacity-90">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* GRID SECTION: 3 per line with increased size */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                    Key Performance Metrics
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <MetricCard
                    label="Total Processed Rows"
                    value={s.total_processed.rows.toLocaleString()}
                    icon={TrendingUp}
                    subtext={`${s.total_processed.fields.toLocaleString()} total data points`}
                    className="bg-emerald-50 border-emerald-100"
                  />
                  <MetricCard
                    label="Auto-mapped Coverage"
                    value={`${s.mapped_data.cols_pct}%`}
                    icon={ListChecks}
                    subtext={`${s.mapped_data.mapped_cols} of ${s.mapped_data.total_cols} columns matched`}
                    className="bg-lime-50 border-lime-100"
                  />
                  <MetricCard
                    label="Data Cleaned"
                    value={s.updated.pct + "%"}
                    icon={BrushCleaning}
                    subtext={`${s.updated.fields} of ${s.updated.total_fields} issues resolved.`}
                    className="bg-violet-50 border-violet-100"
                  />
                  {/* <MetricCard
                    label="AI Success Rate"
                    value={`${s.success_rate.pct}%`}
                    icon={Percent}
                    subtext="Correction accuracy"
                    className="bg-amber-50 border-amber-100"
                  />
                  <MetricCard
                    label="Updated Fields"
                    value={s.updated.fields.toLocaleString()}
                    icon={RefreshCw}
                    subtext={`${s.updated.pct}% field correction rate`}
                    className="bg-fuchsia-50 border-fuchsia-100"
                  />
                  <MetricCard
                    label="Duplicates Removed"
                    value={s.duplicate_findings.rows_removed.toLocaleString()}
                    icon={Copy}
                    subtext={`${s.duplicate_findings.pct}% redundancy found`}
                    className="bg-rose-50 border-rose-100"
                  /> */}
                </div>
              </section>
            </div>
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
  );
}
