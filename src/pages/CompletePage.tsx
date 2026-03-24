import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  TrendingUp,
  PlusCircle,
  RefreshCw,
  Copy,
  Calendar,
  Percent,
  Activity,
  Download
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
    <div className={`rounded-xl border p-8 flex flex-col justify-between min-h-[160px] ${className}`}>
      <div className="flex items-center justify-between opacity-80">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="mt-4">
        <div className="text-4xl font-bold tabular-nums tracking-tight">{value}</div>
        {subtext ? <div className="text-sm font-medium text-muted-foreground mt-1.5 opacity-70">{subtext}</div> : null}
      </div>
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
  const duplicatesRows = s.duplicate_findings.rows_removed;
  const duplicatesPct = s.duplicate_findings.pct;

  // Field-level
  const updatedFields = s.updated.fields;
  const updatedPct = s.updated.pct;
  const autoMappedPct = s.mapped_data.cols_pct;
  const successRatePct = s.success_rate.pct;


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
            <div className="bg-muted/10">
              <div className="w-full animate-in fade-in slide-in-from-top-8 duration-1000">
                {/* Full Width Success Banner */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 px-8 py-8 text-center w-full">
                  {/* Icon */}
                  <div className="flex items-center justify-center h-16 w-16 rounded-full border-2 border-green-500 bg-green-100 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl font-semibold text-foreground">
                    Success!
                  </h1>

                  {/* Subtitle */}
                  <p className="mt-2 text-muted-foreground">
                    Data cleaning completed successfully.
                  </p>

                  {/* Footer info */}
                  <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    {importDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{importDate}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>{totalRows} Rows Processed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Summary Report</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <MetricCard
                  label="Total Processed Rows"
                  value={totalRows}
                  icon={TrendingUp}
                  subtext={`with ${totalFields.toLocaleString()} fields`}
                  className="bg-emerald-100/70 border-emerald-200"
                />
                <MetricCard
                  label="Records Affected"
                  value={affectedRows}
                  icon={Activity}
                  subtext={`${affectedRowsPct}% of total`}
                  className="bg-violet-100/70 border-violet-200"
                />
                <MetricCard
                  label="Success Rate"
                  value={`${successRatePct}%`}
                  icon={Percent}
                  subtext="AI corrected"
                  className="bg-amber-100/70 border-amber-200"
                />
                <MetricCard
                  label="Auto-mapped coverage"
                  value={`${autoMappedPct}%`}
                  icon={PlusCircle}
                  subtext={`${s.mapped_data.mapped_cols}/${s.mapped_data.total_cols} cols`}
                  className="bg-lime-100/70 border-lime-200"
                />
                <MetricCard
                  label="Updated Fields"
                  value={updatedFields}
                  icon={RefreshCw}
                  subtext={`${updatedPct}%`}
                  className="bg-fuchsia-100/70 border-fuchsia-200"
                />
                <MetricCard
                  label="Duplicates Removed"
                  value={duplicatesRows}
                  icon={Copy}
                  subtext={`${duplicatesPct}%`}
                  className="bg-rose-100/70 border-rose-200"
                />
              </div>
            </div>


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