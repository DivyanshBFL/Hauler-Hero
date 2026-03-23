// Mock API service for future integration
// Replace these functions with actual API calls when backend is ready

import { getTargetColumnsForEntity } from '@/constants/targetColumns';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CSVData {
  sheets: SheetData[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
}

export interface EntityMapping {
  entityName: string;
  mappings: FieldMapping[];
}

export interface MappedData {
  data: any[];
}

export interface DataIssueGroup {
  issue_type: string;
  column: string;
  rows: number[];
  count: number;
  severity: string[];
  description: string;
}

export type CleaningRowsPageParams<T extends Record<string, any> = Record<string, any>> = {
  rows: T[];
  page: number;
  pageSize: number;
};

export type CleaningRowsPageResult<T extends Record<string, any> = Record<string, any>> = {
  rows: T[];
  total: number;
  hasMore: boolean;
};

export type CorrectionAction = 'UPDATE' | 'DELETE';

export type CorrectionMappingItem = {
  sourceField: string;
  targetField: string;
  isManual: boolean;
};

export type CorrectionManualChange = {
  sourceField: string;
  previousTargetField: string | null;
  updatedTargetField: string | null;
  action: CorrectionAction;
};

export type CorrectionRequest = {
  entityName: string;
  submittedAt: string;
  mappings: CorrectionMappingItem[];
  manualChanges: CorrectionManualChange[];
};

export type SheetData = {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

export type UploadFileResponse = {
  session_id: string;
};

export type MapRequest = {
  session_id: string;
  entityName: string;
};

export type JoinRequest = {
  session_id: string;
  left_sheet: string;
  right_sheet: string;
  left_key: string;
  right_key: string;
};

export type JoinResponse = {
  success?: boolean;
  message?: string;
};

export type MappingItem = {
  mappingId: string;
  sourceField: string;
  targetField: string;
  confidence: number;
  isManual: boolean;
  updatedAt: string;
};

export type InvalidMappingItem = {
  sourceField: string;
  targetField: string;
  confidence: number;
};

export type MapResponse = {
  entityName: string;
  mappings: MappingItem[];
  validation: {
    invalidMappings: InvalidMappingItem[];
    conflicts: unknown[];
    unmatchedDestinations: string[];
  };
};

export type SessionIssueRow = {
  row_index: number;
  data: Record<string, any>;
  issues: Record<string, string[]>;
};

export interface IssueSummaryDetail {
  columns: string[];
  row_count: number;
  issue_count: number;
}

export interface IssueRow {
  row_index: number;
  data: Record<string, any>;
  issues: Record<string, string[]>;
}

export interface IssuesData {
  summary: Record<string, IssueSummaryDetail>;
  issue_counts: Record<string, number>;
  rows: IssueRow[];
}

export interface RefreshedDataResponse {
  session_id: string;
  recovered: boolean;
  stage: string;
  total_rows: number;
  columns: string[];
  step_count: number;
  redo_available: number;
  last_saved: string;
  issues: IssuesData;
}

export type SessionStartResponse = RefreshedDataResponse;
export type EditItem = {
  seq: number;
  row_index: number;
  column: string;
  old_value: string;
  new_value: string;
};

export type SubmitEditsRequest = {
  edits: EditItem[];
};

export type SubmitEditsResponse = {
  success?: boolean;
  message?: string;
  session_id?: string;
};

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://fraser-calls-father-syndication.trycloudflare.com';

export const API_ROUTES = {
  uploadFile: '/upload-file', //done
  map: '/map', //done
  join: '/join', //done
  sessionStart: '/session/start', //done
  correction: '/correction', //done
  editBySession: '/edit', //done
  columnProfile: '/column-profile', //done
  columnOp: '/column-op', //done
  dedupPreview: '/dedup/preview', //done
  dedupApply: '/dedup/apply', //done
  rollback: '/rollback', //hold
  redo: '/redo', //done
  log: '/log', //done
  export: '/export', //done
  sessionStatus: '/session/status', //done
  autoFix: '/autofix', //done
  sessionSummary: '/summary', //done
  addressCorrector: '/address-corrector', //done
  previewCleaned: '/preview', //done
  refreshedData: '/data'
} as const;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = response.statusText;
      }
    }
    throw new Error(errorDetail || `API ${response.status} error`);
  }

  return response.json() as Promise<T>;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '' || v === 'na' || v === 'n/a' || v === 'null';
  }
  return false;
}

function buildIssueDescription(issueType: string, column: string, count: number): string {
  if (issueType === 'missing_value') {
    return `${count} rows have missing or empty values in ${column}.`;
  }
  if (issueType === 'duplicate_value') {
    return `${count} rows have duplicate values in ${column}.`;
  }
  if (issueType === 'invalid_email') {
    return `${count} rows contain an invalid email format in ${column}.`;
  }
  return `${count} rows are affected in ${column}.`;
}

function detectIssues(data: any[]): DataIssueGroup[] {
  if (!data.length) return [];

  const columns = Object.keys(data[0]);
  const issues: DataIssueGroup[] = [];

  columns.forEach((column) => {
    const missingRows: number[] = [];
    const valueToRows = new Map<string, number[]>();
    const invalidEmailRows: number[] = [];

    data.forEach((row, index) => {
      const rawValue = row[column];

      if (isEmptyValue(rawValue)) {
        missingRows.push(index);
        return;
      }

      const value = String(rawValue).trim();
      const grouped = valueToRows.get(value) ?? [];
      grouped.push(index);
      valueToRows.set(value, grouped);

      if (column.toLowerCase().includes('email')) {
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!validEmail) {
          invalidEmailRows.push(index);
        }
      }
    });

    if (missingRows.length) {
      issues.push({
        issue_type: 'missing_value',
        column,
        rows: missingRows,
        count: missingRows.length,
        severity: [column],
        description: buildIssueDescription('missing_value', column, missingRows.length),
      });
    }

    const duplicateRows = Array.from(valueToRows.values())
      .filter((rowIndexes) => rowIndexes.length > 1)
      .flat();

    if (duplicateRows.length) {
      issues.push({
        issue_type: 'duplicate_value',
        column,
        rows: duplicateRows,
        count: duplicateRows.length,
        severity: [column],
        description: buildIssueDescription('duplicate_value', column, duplicateRows.length),
      });
    }

    if (invalidEmailRows.length) {
      issues.push({
        issue_type: 'invalid_email',
        column,
        rows: invalidEmailRows,
        count: invalidEmailRows.length,
        severity: [column],
        description: buildIssueDescription('invalid_email', column, invalidEmailRows.length),
      });
    }
  });

  return issues
    .sort((a, b) => b.count - a.count)
    .slice(0, 150);
}

function buildStaticIssueFallback(data: any[]): DataIssueGroup[] {
  const totalRows = Math.max(data.length, 1);
  const maxIndex = Math.max(totalRows - 1, 0);
  const inferredColumns = Object.keys(data[0] ?? {});
  const emailColumn = inferredColumns.find((column) => column.toLowerCase().includes('email')) ?? inferredColumns[0] ?? 'Email';
  const phoneColumn = inferredColumns.find((column) => column.toLowerCase().includes('phone')) ?? inferredColumns[1] ?? 'Phone';
  const companyColumn = inferredColumns.find((column) => column.toLowerCase().includes('company')) ?? inferredColumns[2] ?? 'Company';

  const takeByStep = (start: number, step: number, limit: number): number[] => {
    const rows: number[] = [];
    for (let index = start; index <= maxIndex && rows.length < limit; index += step) {
      rows.push(index);
    }
    return rows;
  };

  const missingRows = takeByStep(0, 9, 220);
  const invalidRows = takeByStep(3, 11, 180);
  const duplicateRows = takeByStep(5, 13, 140);

  return [
    {
      issue_type: 'missing_value',
      column: phoneColumn,
      rows: missingRows,
      count: missingRows.length,
      severity: [phoneColumn],
      description: `${missingRows.length} rows contain blank values in ${phoneColumn}.`,
    },
    {
      issue_type: 'invalid_email',
      column: emailColumn,
      rows: invalidRows,
      count: invalidRows.length,
      severity: [emailColumn],
      description: `${invalidRows.length} rows contain invalid ${emailColumn} format.`,
    },
    {
      issue_type: 'duplicate_value',
      column: companyColumn,
      rows: duplicateRows,
      count: duplicateRows.length,
      severity: [companyColumn],
      description: `${duplicateRows.length} rows have duplicate values in ${companyColumn}.`,
    },
  ].filter((issue) => issue.rows.length > 0);
}

function applyAiFixToIssue(rows: any[], issue: DataIssueGroup): { rows: any[]; fixedCount: number } {
  const nextRows = [...rows];
  let fixedCount = 0;

  issue.rows.forEach((rowIndex, issueRowPosition) => {
    const row = nextRows[rowIndex];
    if (!row) return;

    const currentValue = row[issue.column];

    if (issue.issue_type === 'missing_value') {
      if (isEmptyValue(currentValue)) {
        nextRows[rowIndex] = { ...row, [issue.column]: 'N/A' };
        fixedCount += 1;
      }
      return;
    }

    if (issue.issue_type === 'invalid_email') {
      const existing = String(currentValue ?? '').trim();
      if (existing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existing)) {
        const sanitized = existing.includes('@') ? existing : `${existing}@example.com`;
        nextRows[rowIndex] = { ...row, [issue.column]: sanitized.replaceAll(' ', '') };
        fixedCount += 1;
      }
      return;
    }

    if (issue.issue_type === 'duplicate_value') {
      if (issueRowPosition > 0) {
        const base = String(currentValue ?? '').trim() || 'duplicate';
        nextRows[rowIndex] = { ...row, [issue.column]: `${base}-${rowIndex}` };
        fixedCount += 1;
      }
    }
  });

  return { rows: nextRows, fixedCount };
}

export async function uploadFile(file: File): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}${API_ROUTES.uploadFile}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText || response.statusText}`);
  }

  return response.json() as Promise<UploadFileResponse>;
}

export function mapFields(payload: MapRequest): Promise<MapResponse> {
  return apiRequest<MapResponse>(API_ROUTES.map, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function joinSheets(payload: JoinRequest): Promise<JoinResponse> {
  return apiRequest<JoinResponse>(API_ROUTES.join, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Login API
  login: async (credentials: LoginCredentials): Promise<User> => {
    await delay(1500);
    if (credentials.email && credentials.password) {
      return {
        id: '1',
        email: credentials.email,
        name: 'Demo User'
      };
    }
    throw new Error('Invalid credentials');
  },

  // Parse CSV with support for multiple sheets (detecting based on data structure)
  parseCSVWithSheets: async (_file: File): Promise<CSVData> => {
    await delay(1000);
    return {
      sheets: []
    };
  },

  // Auto-map fields for a specific entity (100 target columns per entity)
  autoMapFields: async (headers: string[], entityName?: string): Promise<FieldMapping[]> => {
    await delay(2000);

    const targetFields = getTargetColumnsForEntity(entityName || 'Contact');

    const mappings: FieldMapping[] = headers.map((header, index) => ({
      sourceField: header,
      targetField: index < targetFields.length ? targetFields[index] : targetFields.at(-1)!
    }));

    return mappings;
  },

  // Process mapped data
  processMappedData: async (mappings: FieldMapping[], data: any[]): Promise<MappedData> => {
    await delay(2500);

    const mappedData = data.map(row => {
      const mappedRow: any = {};
      mappings.forEach(mapping => {
        if (mapping.targetField !== 'Unmapped') {
          mappedRow[mapping.targetField] = row[mapping.sourceField];
        }
      });
      return mappedRow;
    });

    return {
      data: mappedData
    };
  },

  analyzeDataIssues: async (data: any[]): Promise<{ issues: DataIssueGroup[] }> => {
    await delay(1200);
    const detectedIssues = detectIssues(data);
    return {
      issues: detectedIssues.length ? detectedIssues : buildStaticIssueFallback(data),
    };
  },

  aiFixIssue: async (data: any[], issue: DataIssueGroup): Promise<{ data: any[]; fixedCount: number }> => {
    await delay(900);
    const result = applyAiFixToIssue(data, issue);
    return {
      data: result.rows,
      fixedCount: result.fixedCount,
    };
  },

  // Final data load
  loadData: async (data: any[]): Promise<{ success: boolean; message: string }> => {
    await delay(2000);

    return {
      success: true,
      message: `Successfully loaded ${data.length} records`
    };
  },

  async getCleaningRowsPage<T extends Record<string, any>>(
    params: CleaningRowsPageParams<T>
  ): Promise<CleaningRowsPageResult<T>> {
    const { rows, page, pageSize } = params;

    if (import.meta.env.VITE_ENABLE_REMOTE_PAGING === 'true') {
      try {
        const q = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
        }).toString();

        const remote = await fetch(`${API_BASE_URL}/cleaning/rows?${q}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (remote.ok) {
          return (await remote.json()) as CleaningRowsPageResult<T>;
        }
      } catch {
        // fallback below
      }
    }

    const start = (page - 1) * pageSize;
    const chunk = rows.slice(start, start + pageSize);
    return {
      rows: chunk,
      total: rows.length,
      hasMore: start + pageSize < rows.length,
    };
  },

  submitMappingCorrections(payload: CorrectionRequest) {
    return apiRequest<MapResponse>(API_ROUTES.correction, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  startSession: async (sessionId: string): Promise<SessionStartResponse> => {
    const q = new URLSearchParams({ session_id: sessionId }).toString();
    return apiRequest<SessionStartResponse>(`${API_ROUTES.sessionStart}?${q}`, {
      method: 'POST',
    });
  },

  submitSessionEdits: async (
    sessionId: string,
    payload: SubmitEditsRequest
  ): Promise<SubmitEditsResponse> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<SubmitEditsResponse>(`${API_ROUTES.editBySession}/${sid}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getColumnProfile: async (sessionId: string, column: string): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.columnProfile}/${sessionId}/${column}`, { method: 'GET' });
  },

  editCells: async (sessionId: string, edits: SubmitEditsRequest): Promise<SubmitEditsResponse> => {
    return apiRequest<SubmitEditsResponse>(`${API_ROUTES.editBySession}/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(edits),
    });
  },

  columnOperation: async (
    sessionId: string,
    column: string,
    operation: {
      operation: string;
      params: Record<string, any>;
    }
  ): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.columnOp}/${sessionId}/${column}`, {
      method: 'POST',
      body: JSON.stringify(operation),
    });
  },

  dedupPreview: async (sessionId: string, payload: any): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.dedupPreview}/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  dedupApply: async (sessionId: string, payload: any): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.dedupApply}/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  rollback: async (sessionId: string, steps: number): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.rollback}/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ steps }),
    });
  },
  redo: async (sessionId: string, steps: number): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.redo}/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ steps }),
    });
  },

  getActivityLog: async (sessionId: string): Promise<any> => {
    return apiRequest<any>(`${API_ROUTES.log}/${sessionId}`, { method: 'GET' });
  },

  exportCleanedData: async (sessionId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.export}/${sessionId}`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Failed to export data: ${response.statusText}`);
    }
    return response.blob();
  },
  getSessionStatus: async (sessionId: string): Promise<{ stage: string }> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<{ stage: string }>(`${API_ROUTES.sessionStatus}/${sid}`, { method: 'GET' });
  },

  autoFix: async (sessionId: string, options?: any): Promise<any> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<any>(`${API_ROUTES.autoFix}/apply/${sid}`, {
      method: 'POST',
      body: options ? JSON.stringify(options) : undefined,
    });
  },

  addressCorrector: async (sessionId: string): Promise<any> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<any>(`${API_ROUTES.addressCorrector}/${sid}`, { method: 'POST' });
  },

  previewCleaned: async (sessionId: string): Promise<any> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<any>(`${API_ROUTES.previewCleaned}/${sid}`, { method: 'GET' });
  },

  fetchSummaryData: async (sessionId: string): Promise<any> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<any>(`${API_ROUTES.sessionSummary}/${sid}`, { method: 'GET' });
  },

   refreshedData: async (sessionId: string): Promise<RefreshedDataResponse> => {
    const sid = encodeURIComponent(sessionId);
    return apiRequest<RefreshedDataResponse>(`${API_ROUTES.refreshedData}/${sid}`, { method: 'GET' });
  },
};
