import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  UploadCloud
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
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtext?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border p-6 flex flex-col justify-between shadow-sm transition-all hover:shadow-md h-40 ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{label}</span>
        <div className="p-2 rounded-lg bg-white/50">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
        {subtext ? <div className="text-sm font-medium text-muted-foreground/70 mt-1">{subtext}</div> : null}
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
      link.download = 'cleaned_data.csv'; // or .json depending on existing API behavior
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting cleaned data:', error);
    }
  };

  if (!stats) return <div className="p-10 text-center">Loading statistics...</div>;

  const s = stats ?? getDefaultImportStats();
  const importDate = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const affectedRows = s.records_affected.rows;
  const unchangedRows = s.unchanged_data.rows;
  const duplicatesRows = s.duplicate_findings.rows_removed;
  const updatedFields = s.updated.fields;

  const affectedRowsPct = s.records_affected.rows_pct;
  const unchangedPct = s.unchanged_data.pct;
  const duplicatesPct = s.duplicate_findings.pct;

  // Calculations for charts
  const donutTotal = Math.max(affectedRows + unchangedRows + duplicatesRows, 1);
  const donutAffectedDeg = Math.round((affectedRows / donutTotal) * 360);
  const donutUnchangedDeg = Math.round((unchangedRows / donutTotal) * 360);

  const maxActionCount = Math.max(affectedRows, updatedFields, duplicatesRows, 1);

  // Outcome stacked bar — normalise to 100 %
  const outcomeSum = Math.max(affectedRowsPct + unchangedPct + duplicatesPct, 1);
  const outcomeAffected = (affectedRowsPct / outcomeSum) * 100;
  const outcomeUnchanged = (unchangedPct / outcomeSum) * 100;
  const outcomeDuplicates = (duplicatesPct / outcomeSum) * 100;

  return (
    <div className={PAGE_OUTER}>
      <div className={PAGE_CONTAINER}>
        <Card className="shadow-none border border-border bg-card animate-in overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-8">
              {/* TOP SECTION: Success Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl border-2 border-green-500 bg-green-50 shadow-inner">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Success!</h1>
                    <p className="text-slate-500 font-medium">Data cleaning and processing completed successfully.</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>Processed on {importDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* GRID SECTION: 3 per line with increased size */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Key Performance Metrics</h2>
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
                    label="Records Affected"
                    value={s.records_affected.rows.toLocaleString()}
                    icon={Activity}
                    subtext={`${s.records_affected.rows_pct}% of total dataset`}
                    className="bg-violet-50 border-violet-100"
                  />
                  <MetricCard
                    label="AI Success Rate"
                    value={`${s.success_rate.pct}%`}
                    icon={Percent}
                    subtext="Correction accuracy"
                    className="bg-amber-50 border-amber-100"
                  />
                  <MetricCard
                    label="Auto-mapped Coverage"
                    value={`${s.mapped_data.cols_pct}%`}
                    icon={PlusCircle}
                    subtext={`${s.mapped_data.mapped_cols} of ${s.mapped_data.total_cols} columns matched`}
                    className="bg-lime-50 border-lime-100"
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
                  />
                </div>
              </section>
            </div>
          </CardContent>

          <div className="flex justify-end gap-3 px-6 py-3 border-t bg-muted">
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
