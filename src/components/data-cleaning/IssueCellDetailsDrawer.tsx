import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Type, X, Loader2 } from 'lucide-react';
import type { IssueCellPanel } from './types';
import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';

// ----------- Column Profile types -----------

type ColumnProfileStats = {
    total_rows?: number;
    null_count?: number;
    null_pct?: number;
    unique_count?: number;
    duplicate_count?: number;
    min_length?: number;
    max_length_val?: number;
    avg_length?: number;
    invalid_email_count?: number;
    field_length_violations?: number;
    max_length_allowed?: number;
};

type ColumnProfileSuggestion = {
    operation: string;
    label: string;
};

type ColumnProfile = {
    column: string;
    target_field?: string;
    dtype_detected?: string;
    dtype_expected?: string;
    stats?: ColumnProfileStats;
    fill_suggestions?: Record<string, any>;
    suggestions?: ColumnProfileSuggestion[];
};

// ----------- Operation form state -----------

type OperationFormState = {
    // change_case
    case?: 'upper' | 'lower' | 'title' | 'camel';
    // fill_empty
    strategy?: 'constant' | 'mode' | 'median';
    value?: string;
    // add_prefix_suffix
    prefix?: string;
    suffix?: string;
    // replace
    find?: string;
    replace?: string;
    use_regex?: boolean;
    // split
    delimiter?: string;
    new_column_name?: string;
    // duplicate_column
    dup_column_name?: string;
};

// ----------- Props -----------

type Props = {
    panel: IssueCellPanel | null;
    sessionId: string | null;
    onClose: () => void;
    onOperationApplied: (column: string, result: any) => void;
    toIssueLabel: (value: string) => string;
};

// ----------- Helpers -----------

function buildOperationPayload(operation: string, form: OperationFormState): Record<string, any> {
    switch (operation) {
        case 'trim_whitespace': return {};
        case 'change_case': return { case: form.case ?? 'title' };
        case 'fill_empty':
            return form.strategy === 'constant'
                ? { strategy: 'constant', value: form.value ?? '' }
                : { strategy: form.strategy ?? 'mode' };
        case 'add_prefix_suffix': return { prefix: form.prefix ?? '', suffix: form.suffix ?? '' };
        case 'replace': return { find: form.find ?? '', replace: form.replace ?? '', use_regex: form.use_regex ?? false };
        case 'split': return { delimiter: form.delimiter ?? ' ', new_column_name: form.new_column_name ?? '' };
        case 'duplicate_column': return { new_column_name: form.dup_column_name ?? '' };
        case 'delete_column': return {};
        default: return {};
    }
}

function hasRequiredParams(operation: string, form: OperationFormState): boolean {
    switch (operation) {
        case 'fill_empty':
            return form.strategy === 'constant' ? (form.value?.trim().length ?? 0) > 0 : true;
        case 'add_prefix_suffix':
            return (form.prefix?.trim().length ?? 0) > 0 || (form.suffix?.trim().length ?? 0) > 0;
        case 'replace':
            return (form.find?.trim().length ?? 0) > 0;
        case 'split':
            return (form.delimiter?.trim().length ?? 0) > 0 && (form.new_column_name?.trim().length ?? 0) > 0;
        case 'duplicate_column':
            return (form.dup_column_name?.trim().length ?? 0) > 0;
        default:
            return true;
    }
}

// ----------- Component -----------

export default function IssueCellDetailsDrawer({ panel, sessionId, onClose, onOperationApplied, toIssueLabel }: Props) {
    const [columnProfile, setColumnProfile] = useState<ColumnProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [activeOperation, setActiveOperation] = useState<string | null>(null);
    const [form, setForm] = useState<OperationFormState>({});
    const [applying, setApplying] = useState(false);
    const [operationError, setOperationError] = useState<string | null>(null);
    const [operationResult, setOperationResult] = useState<{ changedRowCount: number } | null>(null);

    // Reset form/state whenever a new panel opens
    useEffect(() => {
        setActiveOperation(null);
        setForm({});
        setOperationError(null);
        setOperationResult(null);
    }, [panel]);

    // Fetch column profile when column changes
    useEffect(() => {
        if (!panel || !sessionId) {
            setColumnProfile(null);
            return;
        }
        setProfileLoading(true);
        setProfileError(null);

        api.getColumnProfile(sessionId, panel.column)
            .then((profile: ColumnProfile) => setColumnProfile(profile))
            .catch((err: unknown) => setProfileError(err instanceof Error ? err.message : 'Failed to load column profile'))
            .finally(() => setProfileLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel?.column, sessionId]);

    if (!panel) return null;

    const handleSelectOperation = (op: ColumnProfileSuggestion) => {
        if (activeOperation === op.operation) {
            setActiveOperation(null);
            setForm({});
            setOperationError(null);
            setOperationResult(null);
            return;
        }
        setActiveOperation(op.operation);
        setOperationError(null);
        setOperationResult(null);

        // Pre-fill sensible defaults
        const defaults: OperationFormState = {};
        if (op.operation === 'fill_empty') {
            defaults.strategy = 'constant';
            defaults.value = String(columnProfile?.fill_suggestions?.mode ?? '');
        } else if (op.operation === 'change_case') {
            defaults.case = 'title';
        } else if (op.operation === 'split') {
            defaults.delimiter = ' ';
        }
        setForm(defaults);
    };

    const handleApplyOperation = async () => {
        if (!activeOperation || !sessionId) return;
        setApplying(true);
        setOperationError(null);
        setOperationResult(null);
        try {
            const params = buildOperationPayload(activeOperation, form);
            const result = await api.columnOperation(sessionId, panel.column, { operation: activeOperation, params });
            const changedRowCount = Number(result?.rows_affected ?? result?.rows_affected ?? 0);
            setOperationResult({ changedRowCount });
            onOperationApplied(panel.column, result);
        } catch (err: unknown) {
            setOperationError(err instanceof Error ? err.message : 'Operation failed');
        } finally {
            setApplying(false);
        }
    };

    const resetOperationState = () => {
        setActiveOperation(null);
        setForm({});
        setOperationError(null);
        setOperationResult(null);
    };

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div
                className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-background border-l border-border shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-14 px-5 border-b border-border flex items-center justify-between shrink-0">
                    <h3 className="text-base font-normal text-foreground">Column details</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                    {/* Cell info */}
                    <div className="grid grid-cols-2 gap-y-2">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-xs font-medium">{panel.column}</p>
                        <p className="text-xs text-muted-foreground">Value</p>
                        <p className="text-xs font-medium">{panel.value || '—'}</p>
                        <p className="text-xs text-muted-foreground">Issues</p>
                        <p className="text-xs font-medium"> {panel.issueTypes.length ? panel.issueTypes.map(toIssueLabel).join(', ') : '—'} </p>
                        {console.log(panel, "panel")}
                    </div>

                    {/* Loading */}
                    {profileLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading column profile…
                        </div>
                    )}

                    {/* Error */}
                    {profileError && <p className="text-xs text-destructive">{profileError}</p>}

                    {/* Profile data */}
                    {columnProfile && !profileLoading && (
                        <>
                            {/* Type row */}
                            <div className="border-t border-border pt-3">
                                <div className="grid grid-cols-2 gap-y-1.5">
                                    {columnProfile.dtype_detected && (
                                        <>
                                            <p className="text-xs text-muted-foreground">Detected type</p>
                                            <p className="text-xs font-medium">{columnProfile.dtype_detected}</p>
                                        </>
                                    )}
                                    {columnProfile.dtype_expected && (
                                        <>
                                            <p className="text-xs text-muted-foreground">Expected type</p>
                                            <p className="text-xs font-medium">{columnProfile.dtype_expected}</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            {columnProfile.stats && (
                                <div className="border-t border-border pt-3 space-y-2">
                                    <p className="text-xs font-semibold text-foreground">Statistics</p>
                                    <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                                        {columnProfile.stats.total_rows !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Total rows</p><p className="text-xs">{columnProfile.stats.total_rows}</p></>
                                        )}
                                        {columnProfile.stats.null_count !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Null count</p><p className="text-xs">{columnProfile.stats.null_count} ({columnProfile.stats.null_pct}%)</p></>
                                        )}
                                        {columnProfile.stats.unique_count !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Unique values</p><p className="text-xs">{columnProfile.stats.unique_count}</p></>
                                        )}
                                        {columnProfile.stats.duplicate_count !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Duplicates</p><p className="text-xs">{columnProfile.stats.duplicate_count}</p></>
                                        )}
                                        {columnProfile.stats.avg_length !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Avg length</p><p className="text-xs">{columnProfile.stats.avg_length}</p></>
                                        )}
                                        {columnProfile.stats.min_length !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Min length</p><p className="text-xs">{columnProfile.stats.min_length}</p></>
                                        )}
                                        {columnProfile.stats.max_length_val !== undefined && (
                                            <><p className="text-xs text-muted-foreground">Max length</p><p className="text-xs">{columnProfile.stats.max_length_val}</p></>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Suggestions list */}
                            {columnProfile.suggestions && columnProfile.suggestions.length > 0 && (
                                <div className="border-t border-border pt-3 space-y-2">
                                    <p className="text-sm font-semibold">Suggestions</p>

                                    {columnProfile.suggestions.map((s) => (
                                        <div key={s.operation}>
                                            {/* Suggestion button */}
                                            <button
                                                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-xs text-left transition-colors ${activeOperation === s.operation
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:bg-muted'
                                                    }`}
                                                onClick={() => handleSelectOperation(s)}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {s.label}
                                                </span>
                                                <ChevronDown
                                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${activeOperation === s.operation ? 'rotate-180' : '-rotate-90'
                                                        }`}
                                                />
                                            </button>

                                            {/* Inline param form — shown only for the active operation */}
                                            {activeOperation === s.operation && (
                                                <div className="mt-2 px-3 py-3 bg-muted/50 rounded-md border border-border space-y-3">

                                                    {/* trim_whitespace — no params */}
                                                    {s.operation === 'trim_whitespace' && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Trims leading and trailing whitespace from all values in <strong>{panel.column}</strong>.
                                                        </p>
                                                    )}

                                                    {/* change_case */}
                                                    {s.operation === 'change_case' && (
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">Case</label>
                                                            <select
                                                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                                value={form.case ?? 'title'}
                                                                onChange={(e) => setForm((f) => ({ ...f, case: e.target.value as OperationFormState['case'] }))}
                                                            >
                                                                <option value="upper">UPPER CASE</option>
                                                                <option value="lower">lower case</option>
                                                                <option value="title">Title Case</option>
                                                                <option value="camel">camelCase</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* fill_empty */}
                                                    {s.operation === 'fill_empty' && (
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Strategy</label>
                                                                <select
                                                                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                                    value={form.strategy ?? 'constant'}
                                                                    onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value as OperationFormState['strategy'] }))}
                                                                >
                                                                    <option value="constant">Constant value</option>
                                                                    <option value="mode">Mode (most frequent)</option>
                                                                    <option value="median">Median</option>
                                                                </select>
                                                            </div>
                                                            {(form.strategy === 'constant' || !form.strategy) && (
                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-muted-foreground">Fill value</label>
                                                                    <Input
                                                                        autoFocus
                                                                        className="h-8 text-xs"
                                                                        placeholder="Enter fill value…"
                                                                        value={form.value ?? ''}
                                                                        onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* add_prefix_suffix */}
                                                    {s.operation === 'add_prefix_suffix' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Prefix</label>
                                                                <Input
                                                                    autoFocus
                                                                    className="h-8 text-xs"
                                                                    placeholder="e.g. ACC-"
                                                                    value={form.prefix ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Suffix</label>
                                                                <Input
                                                                    className="h-8 text-xs"
                                                                    placeholder="e.g. -v2"
                                                                    value={form.suffix ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* replace */}
                                                    {s.operation === 'replace' && (
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Find</label>
                                                                <Input
                                                                    autoFocus
                                                                    className="h-8 text-xs"
                                                                    placeholder="Text to find…"
                                                                    value={form.find ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, find: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Replace with</label>
                                                                <Input
                                                                    className="h-8 text-xs"
                                                                    placeholder="Replacement text…"
                                                                    value={form.replace ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, replace: e.target.value }))}
                                                                />
                                                            </div>
                                                            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={form.use_regex ?? false}
                                                                    onChange={(e) => setForm((f) => ({ ...f, use_regex: e.target.checked }))}
                                                                />
                                                                Use regex
                                                            </label>
                                                        </div>
                                                    )}

                                                    {/* split */}
                                                    {s.operation === 'split' && (
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">Delimiter</label>
                                                                <Input
                                                                    autoFocus
                                                                    className="h-8 text-xs"
                                                                    placeholder='e.g. " " or ","'
                                                                    value={form.delimiter ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, delimiter: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-xs text-muted-foreground">New column name</label>
                                                                <Input
                                                                    className="h-8 text-xs"
                                                                    placeholder={`e.g. ${panel.column}_part2`}
                                                                    value={form.new_column_name ?? ''}
                                                                    onChange={(e) => setForm((f) => ({ ...f, new_column_name: e.target.value }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* duplicate_column */}
                                                    {s.operation === 'duplicate_column' && (
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-muted-foreground">New column name</label>
                                                            <Input
                                                                autoFocus
                                                                className="h-8 text-xs"
                                                                placeholder={`e.g. ${panel.column}_backup`}
                                                                value={form.dup_column_name ?? ''}
                                                                onChange={(e) => setForm((f) => ({ ...f, dup_column_name: e.target.value }))}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* delete_column — confirmation warning */}
                                                    {s.operation === 'delete_column' && (
                                                        <p className="text-xs text-destructive">
                                                            This will permanently delete the <strong>{panel.column}</strong> column from the session.
                                                        </p>
                                                    )}

                                                    {/* Feedback */}
                                                    {operationError && (
                                                        <p className="text-xs text-destructive">{operationError}</p>
                                                    )}
                                                    {operationResult && (
                                                        <p className="text-xs text-emerald-600">
                                                            Applied — {operationResult.changedRowCount} row(s) updated.
                                                        </p>
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="flex justify-end gap-2 pt-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs px-3"
                                                            onClick={resetOperationState}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs px-3"
                                                            disabled={applying || !hasRequiredParams(s.operation, form)}
                                                            onClick={() => void handleApplyOperation()}
                                                        >
                                                            {applying && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                                            Apply
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}