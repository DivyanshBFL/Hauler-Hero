export const IMPORT_STATS_KEY = 'IMPORT_STATS';

export type ImportStats = {
  total_processed: { rows: number; fields: number };
  records_affected: { rows: number; rows_pct: number; fields: number; fields_pct: number };
  success_rate: {
    description: string;
    ai_fixed_fields: number;
    total_fixed_fields: number;
    pct: number;
  };
  mapped_data: {
    description: string;
    mapped_cols: number;
    total_cols: number;
    mapped_fields: number;
    total_fields: number;
    cols_pct: number;
    fields_pct: number;
  };
  updated: { description: string; fields: number; total_fields: number; pct: number };
  duplicate_findings: { rows_removed: number; total_rows: number; pct: number };
  unchanged_data: { description: string; rows: number; total_rows: number; pct: number };
};

export function getDefaultImportStats(): ImportStats {
  return {
    total_processed: { rows: 0, fields: 0 },
    records_affected: { rows: 0, rows_pct: 0, fields: 0, fields_pct: 0 },
    success_rate: { description: '', ai_fixed_fields: 0, total_fixed_fields: 0, pct: 0 },
    mapped_data: {
      description: '',
      mapped_cols: 0,
      total_cols: 0,
      mapped_fields: 0,
      total_fields: 0,
      cols_pct: 0,
      fields_pct: 0,
    },
    updated: { description: '', fields: 0, total_fields: 0, pct: 0 },
    duplicate_findings: { rows_removed: 0, total_rows: 0, pct: 0 },
    unchanged_data: { description: '', rows: 0, total_rows: 0, pct: 100 },
  };
}