import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  TrendingUp,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  Copy,
  Calendar,
  Percent,
  Activity,
  Download,
  ScrollText
} from 'lucide-react';
import { getDefaultImportStats, type ImportStats } from '@/types/importStats';
import { PAGE_OUTER, PAGE_CONTAINER } from '@/constants/layout';
import { api } from '@/services/api';

function MetricCard({
  label,
  value,
  icon: Icon,
  subtext,
  className = '',
}: Readonly<{
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtext?: string;
  className?: string;
}>) {
  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      {subtext ? <div className="text-[11px] text-muted-foreground">{subtext}</div> : null}
    </div>
  );
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  );

  const escape = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

export function CompletePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ImportStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) throw new Error('Session ID is missing');
        const summaryData = await api.fetchSummaryData(sessionId);
        setStats(summaryData);
      } catch (error) {
        console.error('Error loading summary data:', error);
      }
    };

    fetchData();
  }, []);

  const handleStartOver = () => {
    sessionStorage.clear();
    navigate('/upload');
  };

  const handleDownloadProcessedFile = async () => {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) throw new Error('Session ID is missing');
      const blob = await api.exportCleanedData(sessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cleaned_data.json';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting cleaned data:', error);
    }
  };

  const s = stats ?? getDefaultImportStats();

  // Row-level
  const totalRows = s.total_processed.rows;
  const totalFields = s.total_processed.fields;
  const affectedRows = s.records_affected.rows;
  const affectedRowsPct = s.records_affected.rows_pct;
  const unchangedRows = s.unchanged_data.rows;
  const unchangedPct = s.unchanged_data.pct;
  const duplicatesRows = s.duplicate_findings.rows_removed;
  const duplicatesPct = s.duplicate_findings.pct;

  // Field-level
  const updatedFields = s.updated.fields;
  const updatedPct = s.updated.pct;
  const autoMappedPct = s.mapped_data.cols_pct;
  const successRatePct = s.success_rate.pct;

  // Donut — row level: affected / unchanged / duplicates
  const donutTotal = Math.max(affectedRows + unchangedRows + duplicatesRows, 1);
  const donutAffectedDeg = (affectedRows / donutTotal) * 360;
  const donutUnchangedDeg = (unchangedRows / donutTotal) * 360;
  const donutDupDeg = (duplicatesRows / donutTotal) * 360;

  // By-action bars — use natural max across all four values
  const maxActionCount = Math.max(affectedRows, updatedFields, unchangedRows, duplicatesRows, 1);

  // Outcome stacked bar — normalise to 100 %
  const outcomeSum = Math.max(affectedRowsPct + unchangedPct + duplicatesPct, 1);
  const outcomeAffected = (affectedRowsPct / outcomeSum) * 100;
  const outcomeUnchanged = (unchangedPct / outcomeSum) * 100;
  const outcomeDuplicates = (duplicatesPct / outcomeSum) * 100;

  // Import date — use updated timestamp if available, otherwise fallback to current time
  const importDate =
    // s.updated
    //   ? new Date(s.updated).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }):
    new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className={PAGE_OUTER}>
      <div className={PAGE_CONTAINER}>
        <Card className="border bg-card overflow-hidden">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-center bg-muted/20">
              <div className="flex gap-6 w-full max-w-6xl">

                {/* LEFT: Success Card */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 px-8 py-4 text-center w-full max-w-md">
                  {/* Icon */}
                  <div className="flex items-center justify-center h-14 w-14 rounded-full border-2 border-green-500">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>

                  {/* Title */}
                  <p className="mt-4 text-lg font-semibold text-gray-900">
                    Success!
                  </p>

                  {/* Subtitle */}
                  <p className="mt-2 text-sm text-gray-600">
                    Data cleaning completed. 
                  </p>

                  {/* Footer row */}
                  <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">

                    {importDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{importDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Quick Summary */}
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 w-full max-w-4xl">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center h-7 w-7 rounded-md bg-green-100">
                      <ScrollText className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-base font-semibold text-gray-900">
                      Quick Summary
                    </p>
                  </div>

                  {/* List */}
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>
                        Your CSV was uploaded and parsed into{" "}
                        <span className="font-medium">{totalRows}</span> rows and{" "}
                      <span className="font-medium">{totalFields}</span> fields.
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>
                       Source columns were mapped to the target entity;{" "}
                       <span className="font-medium">
                        {s.mapped_data.mapped_cols}/{s.mapped_data.total_cols} columns matched
                      </span>{" "}
                      ({autoMappedPct}%).
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>
                        <span className="font-medium">{affectedRows}</span> rows affected,{" "}
                      <span className="font-medium">{updatedFields}</span> fields updated,{" "}
                      <span className="font-medium">{duplicatesRows}</span> duplicates removed.
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>
                        Data is now available to download.  
                      </span>
                    </li>
                  </ul>
                </div>

              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Key metrics</div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <MetricCard
                  label="Total Processed Rows"
                  value={totalRows}
                  icon={TrendingUp}
                  subtext={`with ${totalFields.toLocaleString()} fields`}
                  className="bg-emerald-100/70"
                />
                <MetricCard
                  label="Records Affected"
                  value={affectedRows}
                  icon={Activity}
                  subtext={`${affectedRowsPct}% of total`}
                  className="bg-violet-100/70"
                />
                <MetricCard
                  label="Success Rate"
                  value={`${successRatePct}%`}
                  icon={Percent}
                  subtext="AI corrected"
                  className="bg-amber-100/70"
                />
                <MetricCard
                  label="Auto-mapped coverage"
                  value={`${autoMappedPct}%`}
                  icon={PlusCircle}
                  subtext={`${s.mapped_data.mapped_cols}/${s.mapped_data.total_cols} cols`}
                  className="bg-lime-100/70"
                />
                <MetricCard
                  label="Updated Fields"
                  value={updatedFields}
                  icon={RefreshCw}
                  subtext={`${updatedPct}%`}
                  className="bg-fuchsia-100/70"
                />
                <MetricCard
                  label="Unchanged Rows"
                  value={unchangedRows}
                  icon={MinusCircle}
                  subtext={`${unchangedPct}%`}
                  className="bg-blue-100/70"
                />
                <MetricCard
                  label="Duplicates Removed"
                  value={duplicatesRows}
                  icon={Copy}
                  subtext={`${duplicatesPct}%`}
                  className="bg-rose-100/70"
                />
              </div>
            </div>

            {/* <div className="rounded-lg border bg-muted/30 p-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                
                <div className="rounded-md border bg-background px-3 py-2 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Affected
                  </span>
                  <span className="font-semibold">{affectedRowsPct}%</span>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Updated Fields
                  </span>
                  <span className="font-semibold">{updatedPct}%</span>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                    Unchanged
                  </span>
                  <span className="font-semibold">{unchangedPct}%</span>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Duplicates
                  </span>
                  <span className="font-semibold">{duplicatesPct}%</span>
                </div>
              </div>
            </div> */}

            {/* 3 panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-semibold mb-3">Record breakdown</div>
                <div className="flex items-center gap-4">
                  <div
                    className="h-28 w-28 rounded-full border"
                    style={{
                      background: `conic-gradient(
                          #3b82f6 0deg ${donutAffectedDeg}deg,
                          #d1d5db ${donutAffectedDeg}deg ${donutAffectedDeg + donutUnchangedDeg}deg,
                          #ef4444 ${donutAffectedDeg + donutUnchangedDeg}deg 360deg
                        )`,
                    }}
                  />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Affected <b>{affectedRows}</b></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />Unchanged <b>{unchangedRows}</b></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Duplicates <b>{duplicatesRows}</b></div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-semibold mb-3">By action</div>
                {[
                  { label: 'Affected Rows', value: affectedRows, color: 'bg-blue-500' },
                  { label: 'Updated Fields', value: updatedFields, color: 'bg-amber-500' },
                  { label: 'Unchanged Rows', value: unchangedRows, color: 'bg-zinc-400' },
                  { label: 'Duplicates', value: duplicatesRows, color: 'bg-rose-500' },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 mb-2 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <div className="h-2.5 rounded bg-background overflow-hidden">
                      <div
                        className={`h-full ${row.color}`}
                        style={{ width: `${Math.round((row.value / maxActionCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right font-medium tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-semibold mb-3">Outcome overview</div>
                <div className="h-11 rounded-md bg-background overflow-hidden flex">
                  <div style={{ width: `${outcomeAffected}%` }} className="bg-blue-500" />
                  <div style={{ width: `${outcomeUnchanged}%` }} className="bg-zinc-400" />
                  <div style={{ width: `${outcomeDuplicates}%` }} className="bg-rose-500" />
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <b className="text-foreground">{affectedRowsPct}%</b> Affected &nbsp;&nbsp;
                  <b className="text-foreground">{unchangedPct}%</b> Unchanged &nbsp;&nbsp;
                  <b className="text-foreground">{duplicatesPct}%</b> Duplicates
                </div>
              </div>
            </div>

            {/* <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-semibold mb-2">What happened</div>
              <ul className="text-sm space-y-2 text-foreground">
                <li>• Your CSV was uploaded and parsed into <span className="font-medium tabular-nums">{totalRows}</span> rows and <span className="font-medium tabular-nums">{totalFields.toLocaleString()}</span> fields.</li>
                <li>• Source columns were mapped to the target entity; <span className="font-medium tabular-nums">{s.mapped_data.mapped_cols}/{s.mapped_data.total_cols}</span> columns matched ({autoMappedPct}%).</li>
                <li>• <span className="font-medium tabular-nums">{affectedRows}</span> rows affected, <span className="font-medium tabular-nums">{updatedFields}</span> fields updated, <span className="font-medium tabular-nums">{duplicatesRows}</span> duplicates removed.</li>
                <li>• Data is now available in the system.</li>
              </ul>
            </div> */}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant="outline" onClick={handleDownloadProcessedFile} className="flex-1 h-10">
                <Download className="h-4 w-4 mr-2" />
                Download Processed File
              </Button>
              <Button onClick={handleStartOver} className="flex-1 h-10 font-semibold">
                <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Process Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}