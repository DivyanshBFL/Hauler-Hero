import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X } from 'lucide-react';
import type { ColumnAction, ColumnActionModal } from './types';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

type MenuItem = { action: ColumnAction; label: string };

type ColumnOperationResult = { changedRowCount: number; columnProfile: any };

type Props = {
  modal: ColumnActionModal | null;
  menuItems: MenuItem[];
  sessionId: string | null;
  onClose: () => void;
  onOperationApplied: (column: string, result: ColumnOperationResult) => void;
};

// Maps the local ColumnAction enum to the API operation string and builds params
function buildPayload(
  action: ColumnAction,
  form: { replaceFrom: string; replaceTo: string; useRegex: boolean; truncateLen: string; prefix: string; suffix: string }
): { operation: string; params: Record<string, any> } {
  switch (action) {
    case 'trimSpaces':
      return { operation: 'trim_whitespace', params: {} };
    case 'replaceValues':
      return {
        operation: 'replace',
        params: { find: form.replaceFrom, replace: form.replaceTo, use_regex: form.useRegex },
      };
    case 'truncateValues':
      return {
        operation: 'truncate',
        params: { max_length: Math.max(1, parseInt(form.truncateLen, 10) || 20) },
      };
    case 'addPrefixOrSuffix':
      return {
        operation: 'add_prefix_suffix',
        params: { prefix: form.prefix, suffix: form.suffix },
      };
  }
}

function isApplyEnabled(action: ColumnAction, form: { replaceFrom: string; prefix: string; suffix: string; truncateLen: string }): boolean {
  if (action === 'replaceValues') return form.replaceFrom.trim().length > 0;
  if (action === 'addPrefixOrSuffix') return form.prefix.trim().length > 0 || form.suffix.trim().length > 0;
  if (action === 'truncateValues') return parseInt(form.truncateLen, 10) > 0;
  return true;
}

export default function ColumnActionDialog({ modal, menuItems, sessionId, onClose, onOperationApplied }: Props) {
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [truncateLen, setTruncateLen] = useState('20');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ changedRowCount: number } | null>(null);

  // Reset form state whenever a new modal opens
  useEffect(() => {
    if (modal) {
      setReplaceFrom('');
      setReplaceTo('');
      setUseRegex(false);
      setTruncateLen('20');
      setPrefix('');
      setSuffix('');
      setError(null);
      setResult(null);
    }
  }, [modal?.column, modal?.action]);

  if (!modal) return null;

  const form = { replaceFrom, replaceTo, useRegex, truncateLen, prefix, suffix };
  const canApply = isApplyEnabled(modal.action, form) && !applying;

  const handleApply = async () => {
    if (!sessionId) {
      setError('No active session — cannot apply operation.');
      return;
    }
    setApplying(true);
    setError(null);
    setResult(null);
    try {
      const { operation, params } = buildPayload(modal.action, form);
      const res = await api.columnOperation(sessionId, modal.column, { operation, params });
      setResult({ changedRowCount: res.changedRowCount });
      onOperationApplied(modal.column, res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setApplying(false);
    }
  };

  const label = menuItems.find((m) => m.action === modal.action)?.label ?? modal.action;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl leading-none font-light text-foreground">
            {label}
            <span className="ml-1 text-muted-foreground font-normal">— {modal.column}</span>
          </h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* replaceValues */}
        {modal.action === 'replaceValues' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Find</label>
              <Input autoFocus className="h-8 text-xs" value={replaceFrom} onChange={(e) => setReplaceFrom(e.target.value)} placeholder="Text to find" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Replace with</label>
              <Input className="h-8 text-xs" value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)} placeholder="Replacement text" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
              Use regex
            </label>
          </div>
        )}

        {/* trimSpaces */}
        {modal.action === 'trimSpaces' && (
          <p className="text-xs text-muted-foreground">
            Leading and trailing whitespace will be removed from all values in <strong>{modal.column}</strong>.
          </p>
        )}

        {/* truncateValues */}
        {modal.action === 'truncateValues' && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max characters</label>
            <Input autoFocus type="number" className="h-8 text-xs w-32" value={truncateLen} min={1} onChange={(e) => setTruncateLen(e.target.value)} />
          </div>
        )}

        {/* addPrefixOrSuffix */}
        {modal.action === 'addPrefixOrSuffix' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prefix</label>
              <Input autoFocus className="h-8 text-xs" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. ID-" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Suffix</label>
              <Input className="h-8 text-xs" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. _v2" />
            </div>
          </div>
        )}

        {/* Feedback */}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {result && (
          <p className="text-xs text-emerald-600">Applied — {result.changedRowCount} row(s) updated.</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button size="sm" className="flex-1 text-xs" disabled={!canApply} onClick={() => void handleApply()}>
            {applying && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}