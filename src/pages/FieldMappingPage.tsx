import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type OnEdgesDelete,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/services/api';
import type { CorrectionRequest, CorrectionManualChange } from '@/services/api';
import type { FieldMapping, SheetData } from '@/services/api';
import { Loader2, Search, Bot, Send, ChevronRight, ChevronLeft, GitMerge } from 'lucide-react';
import { SourceFieldNode, TargetFieldNode } from '@/components/field-mapping';
import { getTargetColumnsForEntity, getRequiredTargetColumnsForEntity } from '@/constants/targetColumns';
import { PAGE_OUTER, PAGE_CONTAINER } from '@/constants/layout';
import ProcessStepper from '@/components/ProcessStepper';
import type { MapResponse } from '@/services/api';
import { toast } from 'sonner';

const ROW_HEIGHT = 44;
const HORIZONTAL_COLUMN_MARGIN = 48;
const MISSING_SOURCE_TEXT = 'Column not found in Source';
const NODE_TYPES = { sourceField: SourceFieldNode, targetField: TargetFieldNode };

const EMPTY_HEADERS: string[] = [];
const EMPTY_MAPPINGS: FieldMapping[] = [];

const SOURCE_PREFIX = 'source-';
const TARGET_PREFIX = 'target-';
const MAPPING_VIEWPORT_HEIGHT = 620;

type ChatRole = 'user' | 'assistant';
type ChatMessage = { id: string; role: ChatRole; text: string };

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replaceAll(/[\s_-]+/g, '').replaceAll(/[^a-z0-9]/g, '');
}

function fieldNamesMatch(source: string, target: string): boolean {
  return normalizeFieldName(source) === normalizeFieldName(target);
}

function filterMappingsByName(mappings: FieldMapping[]): FieldMapping[] {
  return mappings.filter((m) => fieldNamesMatch(m.sourceField, m.targetField));
}

function buildNameBasedAutoMappings(headers: string[], targetFields: string[]): FieldMapping[] {
  const usedTargets = new Set<string>();
  const result: FieldMapping[] = [];

  headers.forEach((header) => {
    const matched = targetFields.find((t) => fieldNamesMatch(header, t) && !usedTargets.has(t));
    if (matched) {
      usedTargets.add(matched);
      result.push({ sourceField: header, targetField: matched });
    }
  });

  return result;
}

function getTargetOptionsForEntity(entity: string): string[] {
  return getTargetColumnsForEntity(entity);
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveFieldName(candidate: string, allowedFields: string[]): { value?: string; error?: string } {
  const cleaned = stripWrappingQuotes(candidate);
  if (!cleaned) {
    return { error: 'Field name is empty.' };
  }

  const normalizedInput = normalizeFieldName(cleaned);
  const exactMatches = allowedFields.filter((field) => normalizeFieldName(field) === normalizedInput);

  if (exactMatches.length === 1) {
    return { value: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { error: `Field name "${cleaned}" is ambiguous. Please use the full field name.` };
  }

  const partialMatches = allowedFields.filter(
    (field) => field.toLowerCase().includes(cleaned.toLowerCase()) || normalizeFieldName(field).includes(normalizedInput)
  );

  if (partialMatches.length === 1) {
    return { value: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return {
      error: `Field "${cleaned}" matched multiple fields: ${partialMatches.slice(0, 4).join(', ')}${partialMatches.length > 4 ? ', ...' : ''
        }.`,
    };
  }

  return { error: `Field "${cleaned}" was not found.` };
}

/** Reorder lists so mapped pairs are shown first and aligned on the same row index. */
function buildAlignedFieldOrder(
  sourceFields: string[],
  targetFields: string[],
  mappings: FieldMapping[]
): { orderedSource: string[]; orderedTarget: string[] } {
  const sourceSet = new Set(sourceFields);
  const targetSet = new Set(targetFields);

  const usedSource = new Set<string>();
  const usedTarget = new Set<string>();
  const mappedPairs: Array<{ sourceField: string; targetField: string }> = [];

  for (const m of mappings) {
    if (!sourceSet.has(m.sourceField) || !targetSet.has(m.targetField)) continue;
    if (usedSource.has(m.sourceField) || usedTarget.has(m.targetField)) continue;
    usedSource.add(m.sourceField);
    usedTarget.add(m.targetField);
    mappedPairs.push({ sourceField: m.sourceField, targetField: m.targetField });
  }

  const orderedSource = [
    ...mappedPairs.map((p) => p.sourceField),
    ...sourceFields.filter((s) => !usedSource.has(s)),
  ];
  const orderedTarget = [
    ...mappedPairs.map((p) => p.targetField),
    ...targetFields.filter((t) => !usedTarget.has(t)),
  ];

  return { orderedSource, orderedTarget };
}

function buildNodesAndEdges(
  sourceFields: string[],
  targetFields: string[],
  mappings: FieldMapping[],
  sourceTypeMap: Record<string, FieldDataType>,
  targetTypeMap: Record<string, FieldDataType>,
  sourceX: number,
  targetX: number,
  nodeWidth: number,
  requiredTargetSet: Set<string>,
  onUnmapTarget: (targetField: string) => void,
  selectedEdgeId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const active = mappings.filter((m) => m.targetField !== 'Unmapped');
  const mappedSource = new Set(active.map((m) => m.sourceField));
  const mappedTarget = new Set(active.map((m) => m.targetField));

  sourceFields.forEach((label, i) => {
    const mapped = mappedSource.has(label);

    const showMissingSourceText = false;

    nodes.push({
      id: `${SOURCE_PREFIX}${label}`,
      type: 'sourceField',
      position: { x: sourceX, y: 10 + i * ROW_HEIGHT },
      data: {
        label: showMissingSourceText ? MISSING_SOURCE_TEXT : label,
        dataType: sourceTypeMap[label],
        status: mapped ? 'mapped' : 'unmapped',
        nodeWidth,
        hideDataType: false, // hide datatype when "Column not found in Source"
        draggable: showMissingSourceText,
      },
      style: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
      },
      draggable: false,
      selectable: false,
    });
  });

  targetFields.forEach((label, i) => {
    const mapped = mappedTarget.has(label);
    const isRequired = requiredTargetSet.has(label);

    nodes.push({
      id: `${TARGET_PREFIX}${label}`,
      type: 'targetField',
      position: { x: targetX, y: 10 + i * ROW_HEIGHT },
      data: {
        label: isRequired ? (
          <>
            {label} <span style={{ color: '#ef4444' }}>*</span>
          </>
        ) : (
          label
        ),
        fieldName: label,
        dataType: targetTypeMap[label],
        status: mapped ? 'mapped' : 'unmapped',
        nodeWidth,
        isWarning: !mapped,
        onUnmap: onUnmapTarget,
      },
      style: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
      },
      draggable: false,
      selectable: false,
    });
  });


  const edges: Edge[] = active
    .filter((m) => sourceFields.includes(m.sourceField) && targetFields.includes(m.targetField))
    .map((m) => {
      const id = `e-${m.sourceField}-${m.targetField}`;
      const isSelected = id === selectedEdgeId;
      return {
        id,
        source: `${SOURCE_PREFIX}${m.sourceField}`,
        target: `${TARGET_PREFIX}${m.targetField}`,
        type: 'default',
        pathOptions: { curvature: 0.5 },
        style: {
          stroke: isSelected ? 'hsl(222, 84%, 36%)' : 'hsl(211, 88%, 52%)',
          strokeWidth: isSelected ? 4 : 2.5,
        },
        zIndex: isSelected ? 1000 : 1,
        animated: isSelected,
        selectable: true,
        deletable: true,
      } as Edge;
    });

  return { nodes, edges };
}
type FieldDataType = 'TEXT' | 'NUMBER' | 'EMAIL' | 'DATE' | 'BOOLEAN';

function inferFieldDataType(fieldName: string): FieldDataType {
  const n = fieldName.toLowerCase();
  if (n.includes('email')) return 'EMAIL';
  if (/(phone|mobile|fax|tel|qty|count|amount|price|total|zip|postal|pin|age|number)/i.test(n)) return 'NUMBER';
  if (/(date|dob|birth|created|updated|time)/i.test(n)) return 'DATE';
  if (/(^is[A-Z_]|^has[A-Z_]|flag|active|enabled|optin|optout)/i.test(fieldName)) return 'BOOLEAN';
  return 'TEXT';
}

function isTypeMismatch(sourceType: FieldDataType, targetType: FieldDataType): boolean {
  if (sourceType === targetType) return false;
  // TEXT is treated as generic/flexible.
  if (sourceType === 'TEXT' || targetType === 'TEXT') return false;
  return true;
}

function getSessionCount(...keys: string[]): number {
  for (const key of keys) {
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;

    const direct = Number(raw);
    if (!Number.isNaN(direct)) return direct;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'number') return parsed;
      if (parsed && typeof parsed.count === 'number') return parsed.count;
    } catch {
      // ignore
    }
  }
  return 0;
}

function toActiveMappings(mappings: FieldMapping[]): FieldMapping[] {
  return mappings.filter((m) => m.targetField !== 'Unmapped');
}

function buildCorrectionPayload(
  entityName: string,
  currentMappings: FieldMapping[],
  baselineMappings: FieldMapping[]
): CorrectionRequest | null {
  const currentActive = toActiveMappings(currentMappings);
  const baselineActive = toActiveMappings(baselineMappings);

  const currentBySource = new Map(currentActive.map((m) => [m.sourceField, m.targetField]));
  const baselineBySource = new Map(baselineActive.map((m) => [m.sourceField, m.targetField]));

  const allSources = new Set<string>([
    ...Array.from(currentBySource.keys()),
    ...Array.from(baselineBySource.keys()),
  ]);

  const manualChanges: CorrectionManualChange[] = [];
  const manuallyChangedSources = new Set<string>();

  allSources.forEach((sourceField) => {
    const previousTargetField = baselineBySource.get(sourceField) ?? null;
    const updatedTargetField = currentBySource.get(sourceField) ?? null;

    if (previousTargetField === updatedTargetField) return;

    if (previousTargetField && !updatedTargetField) {
      manualChanges.push({
        sourceField,
        previousTargetField,
        updatedTargetField: null,
        action: 'DELETE',
      });
      return;
    }

    if (updatedTargetField) {
      manualChanges.push({
        sourceField,
        previousTargetField,
        updatedTargetField,
        action: 'UPDATE',
      });
      manuallyChangedSources.add(sourceField);
    }
  });

  if (manualChanges.length === 0) return null;

  return {
    entityName,
    submittedAt: new Date().toISOString(),
    mappings: currentActive.map((m) => ({
      sourceField: m.sourceField,
      targetField: m.targetField,
      isManual: manuallyChangedSources.has(m.sourceField),
    })),
    manualChanges,
  };
}

export function FieldMappingPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [entityMappings, setEntityMappings] = useState<{ [key: string]: FieldMapping[] }>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'chat-welcome',
      role: 'assistant',
      text: 'Command bot ready. Try: map "Email" to "email", unmap "Phone", auto map, clear mappings, or show mappings.',
    },
  ]);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [baselineMappingsByEntity, setBaselineMappingsByEntity] = useState<{ [key: string]: FieldMapping[] }>({});
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const lastPointerY = useRef(0);
  const [autoMappedCountByEntity, setAutoMappedCountByEntity] = useState<{ [key: string]: number }>({});

  const navigate = useNavigate();

  const currentSheet = useMemo(() => sheets.find((s) => s.name === selectedEntity), [sheets, selectedEntity]);
  const sourceFieldsAll = useMemo(() => currentSheet?.headers ?? EMPTY_HEADERS, [currentSheet]);
  const targetFieldsAll = useMemo(() => getTargetOptionsForEntity(selectedEntity), [selectedEntity]);
  const requiredTargetFields = useMemo(() => getRequiredTargetColumnsForEntity(selectedEntity), [selectedEntity]);
  const requiredTargetSet = useMemo(() => new Set(requiredTargetFields), [requiredTargetFields]);
  const mappings = entityMappings[selectedEntity] ?? EMPTY_MAPPINGS;

  const sourceTypeMap = useMemo(
    () => Object.fromEntries(sourceFieldsAll.map((f) => [f, inferFieldDataType(f)])) as Record<string, FieldDataType>,
    [sourceFieldsAll]
  );
  const targetTypeMap = useMemo(
    () => Object.fromEntries(targetFieldsAll.map((f) => [f, inferFieldDataType(f)])) as Record<string, FieldDataType>,
    [targetFieldsAll]
  );

  const activeMappings = useMemo(() => mappings.filter((m) => m.targetField !== 'Unmapped'), [mappings]);
  const mappedSourceSet = useMemo(() => new Set(activeMappings.map((m) => m.sourceField)), [activeMappings]);
  const mappedTargetSet = useMemo(() => new Set(activeMappings.map((m) => m.targetField)), [activeMappings]);

  const mismatchPairs = useMemo(
    () =>
      activeMappings.filter(
        (m) =>
          sourceTypeMap[m.sourceField] &&
          targetTypeMap[m.targetField] &&
          isTypeMismatch(sourceTypeMap[m.sourceField], targetTypeMap[m.targetField])
      ),
    [activeMappings, sourceTypeMap, targetTypeMap]
  );

  const sourceErrorSet = useMemo(() => {
    const set = new Set<string>();
    sourceFieldsAll.forEach((f) => {
      if (!mappedSourceSet.has(f)) set.add(f);
    });
    mismatchPairs.forEach((m) => set.add(m.sourceField));
    return set;
  }, [sourceFieldsAll, mappedSourceSet, mismatchPairs]);

  const targetErrorSet = useMemo(() => {
    const set = new Set<string>();
    targetFieldsAll.forEach((f) => {
      if (!mappedTargetSet.has(f)) set.add(f);
    });
    mismatchPairs.forEach((m) => set.add(m.targetField));
    return set;
  }, [targetFieldsAll, mappedTargetSet, mismatchPairs]);

  const autoMappedCount = autoMappedCountByEntity[selectedEntity] ?? 0;
  const autoMappedCoveragePct = useMemo(
    () => (targetFieldsAll.length ? Math.round((autoMappedCount / targetFieldsAll.length) * 100) : 0),
    [autoMappedCount, targetFieldsAll.length]
  );

  const autoMappedCoverageClass = useMemo(() => {
    if (autoMappedCoveragePct > 60) return 'rounded-md bg-green-200 text-green-800 px-2 py-0.5 font-semibold';
    if (autoMappedCoveragePct > 40) return 'rounded-md bg-yellow-200 text-yellow-800 px-2 py-0.5 font-semibold';
    return 'rounded-md bg-red-200 text-red-800 px-2 py-0.5 font-semibold';
  }, [autoMappedCoveragePct]);

  const unmatchedColumnsCount = useMemo(
    () =>
      sourceFieldsAll.filter((f) => !mappedSourceSet.has(f)).length,
    [sourceFieldsAll, mappedSourceSet]
  );
  const dataTypeMismatchCount = mismatchPairs.length;
  const dataSizeOverflowWarningCount = useMemo(
    () => getSessionCount('dataSizeOverflowWarnings', 'dataSizeOverflowCount', 'overflowWarnings'),
    []
  );

  const sourceFields = useMemo(() => {
    let list = sourceFieldsAll;
    if (showOnlyErrors) list = list.filter((f) => sourceErrorSet.has(f));
    if (!sourceSearch.trim()) return list;
    const q = sourceSearch.trim().toLowerCase();
    return list.filter((f) => f.toLowerCase().includes(q));
  }, [sourceFieldsAll, sourceSearch, showOnlyErrors, sourceErrorSet]);

  const targetFields = useMemo(() => {
    let list = targetFieldsAll;
    if (showOnlyErrors) list = list.filter((f) => targetErrorSet.has(f));
    if (!targetSearch.trim()) return list;
    const q = targetSearch.trim().toLowerCase();
    return list.filter((f) => f.toLowerCase().includes(q));
  }, [targetFieldsAll, targetSearch, showOnlyErrors, targetErrorSet]);

  const { orderedSource, orderedTarget } = useMemo(
    () => buildAlignedFieldOrder(sourceFields, targetFields, mappings),
    [sourceFields, targetFields, mappings]
  );

  const mappingContentHeight = Math.max(orderedSource.length, orderedTarget.length, 1) * ROW_HEIGHT + 40;
  const flowPaneRef = useRef<HTMLDivElement | null>(null);
  const [flowPaneWidth, setFlowPaneWidth] = useState(900);

  useEffect(() => {
    if (!flowPaneRef.current) return;
    const el = flowPaneRef.current;

    const update = () => setFlowPaneWidth(el.clientWidth || 900);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chatCollapsed]);

  const nodeWidth = chatCollapsed ? 420 : 300;
  const flowCanvasWidth = Math.max(flowPaneWidth, nodeWidth * 2 + HORIZONTAL_COLUMN_MARGIN * 2 + 300);
  const sourceX = HORIZONTAL_COLUMN_MARGIN;
  const targetX = flowCanvasWidth - HORIZONTAL_COLUMN_MARGIN - nodeWidth;
  const handleUnmapTarget = (targetField: string) => {
    setEntityMappings((prev) => {
      const current = prev[selectedEntity] ?? [];
      const updated = current.filter((m) => m.targetField !== targetField);
      return { ...prev, [selectedEntity]: updated };
    });
  };

  const initialNodesAndEdges = useMemo(
    () =>
      buildNodesAndEdges(
        orderedSource,
        orderedTarget,
        mappings,
        sourceTypeMap,
        targetTypeMap,
        sourceX,
        targetX,
        nodeWidth,
        requiredTargetSet,
        handleUnmapTarget,
        selectedEdgeId
      ),
    [orderedSource, orderedTarget, mappings, sourceTypeMap, targetTypeMap, sourceX, targetX, nodeWidth, requiredTargetSet, selectedEntity, selectedEdgeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesAndEdges.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialNodesAndEdges.edges);

  useEffect(() => {
    setNodes(initialNodesAndEdges.nodes);
    setEdges(initialNodesAndEdges.edges);
  }, [initialNodesAndEdges, setNodes, setEdges]);

  useEffect(() => {
    const loadMappings = async () => {
      const sheetsStr = sessionStorage.getItem('sheets');
      if (!sheetsStr) {
        navigate('/upload');
        return;
      }

      const loadedSheets = JSON.parse(sheetsStr) as SheetData[];
      let effectiveSheets = loadedSheets;

      const joinSelectionStr = sessionStorage.getItem('joinSelection');
      const sheetHeadersByNameStr = sessionStorage.getItem('sheetHeadersByName');

      if (joinSelectionStr && sheetHeadersByNameStr && loadedSheets.length > 0) {
        try {
          const parsedJoin = JSON.parse(joinSelectionStr) as {
            leftSheet?: string;
            rightSheet?: string;
          };
          const parsedHeadersByName = JSON.parse(sheetHeadersByNameStr) as Record<string, string[]>;

          const leftHeaders = parsedHeadersByName[parsedJoin.leftSheet ?? ''] ?? [];
          const rightHeaders = parsedHeadersByName[parsedJoin.rightSheet ?? ''] ?? [];
          const mergedHeaders = Array.from(new Set([...leftHeaders, ...rightHeaders]));

          if (mergedHeaders.length > 0) {
            effectiveSheets = loadedSheets.map((sheet, index) =>
              index === 0
                ? {
                  ...sheet,
                  headers: mergedHeaders,
                }
                : sheet
            );
          }
        } catch (error) {
          console.error('Invalid joinSelection or sheetHeadersByName in sessionStorage', error);
        }
      }

      setSheets(effectiveSheets);

      const defaultEntity = effectiveSheets[0]?.name ?? '';
      if (defaultEntity && !selectedEntity) setSelectedEntity(defaultEntity);

      // Start with saved mappings (if any), else name-based auto mappings
      let nextEntityMappings: { [key: string]: FieldMapping[] } = {};
      let nextAutoMappedCountByEntity: { [key: string]: number } = {};
      const mappingsStr = sessionStorage.getItem('entityMappings');

      if (mappingsStr) {
        const parsed = JSON.parse(mappingsStr) as { [key: string]: FieldMapping[] };
        for (const [entity, maps] of Object.entries(parsed)) {
          nextEntityMappings[entity] = filterMappingsByName(maps);
        }
      } else {
        for (const sheet of effectiveSheets) {
          const targetFields = getTargetOptionsForEntity(sheet.name);
          nextEntityMappings[sheet.name] = buildNameBasedAutoMappings(sheet.headers, targetFields);
          nextAutoMappedCountByEntity[sheet.name] = 0;
        }
      }

      // Override with backend /map response (this drives ReactFlow edges)
      const mappingResponseStr = sessionStorage.getItem('mappingResponse');
      if (mappingResponseStr) {
        try {
          const response = JSON.parse(mappingResponseStr) as MapResponse;

          const entityFromApi =
            effectiveSheets.find((s) => s.name === response.entityName)?.name ?? defaultEntity;

          if (entityFromApi && !selectedEntity) {
            setSelectedEntity(entityFromApi);
          }

          const sourceHeaders =
            effectiveSheets.find((s) => s.name === entityFromApi)?.headers ?? [];
          const allowedTargets = getTargetOptionsForEntity(entityFromApi);

          const apiMappings: FieldMapping[] = (response.mappings ?? [])
            .map((m) => ({
              sourceField: m.sourceField,
              targetField: m.targetField,
            }))
            .filter(
              (m) =>
                sourceHeaders.includes(m.sourceField) &&
                allowedTargets.includes(m.targetField)
            );

          nextEntityMappings = {
            ...nextEntityMappings,
            [entityFromApi]: apiMappings,
          };

          nextAutoMappedCountByEntity = {
            ...nextAutoMappedCountByEntity,
            [entityFromApi]: apiMappings.length,
          };
        } catch (e) {
          console.error('Invalid mappingResponse in sessionStorage', e);
        }
      }

      setEntityMappings(nextEntityMappings);
      setAutoMappedCountByEntity(nextAutoMappedCountByEntity);
      setBaselineMappingsByEntity(
        JSON.parse(JSON.stringify(nextEntityMappings)) as { [key: string]: FieldMapping[] }
      );
      setLoading(false);
    };

    loadMappings();
  }, [navigate, selectedEntity]);

  useEffect(() => {
    if (sheets.length > 0 && !selectedEntity) setSelectedEntity(sheets[0].name);
  }, [sheets, selectedEntity]);

  const runChatCommand = (command: string): string => {
    const trimmed = command.trim();
    if (!trimmed) return 'Please enter a command.';

    if (/^(help|commands)$/i.test(trimmed)) {
      return 'Supported commands: map <source> to <target>, unmap <source>, auto map, clear mappings, show mappings.';
    }

    if (/^(show|list)\s+mappings$/i.test(trimmed)) {
      const active = (entityMappings[selectedEntity] ?? []).filter((m) => m.targetField !== 'Unmapped');
      if (active.length === 0) return `No mappings currently set for ${selectedEntity}.`;
      const preview = active.slice(0, 8).map((m) => `${m.sourceField} -> ${m.targetField}`).join('; ');
      return active.length > 8 ? `${preview}; ... (${active.length} total)` : preview;
    }

    if (/^auto\s*map$/i.test(trimmed)) {
      const autoMappings = buildNameBasedAutoMappings(sourceFieldsAll, targetFieldsAll);
      setEntityMappings((prev) => ({ ...prev, [selectedEntity]: autoMappings }));
      return `Auto mapping completed for ${selectedEntity}. ${autoMappings.length} fields mapped.`;
    }

    if (/^(clear|reset)\s+mappings$/i.test(trimmed)) {
      setEntityMappings((prev) => ({ ...prev, [selectedEntity]: [] }));
      return `All mappings cleared for ${selectedEntity}.`;
    }

    const unmapMatch = trimmed.match(/^(unmap|remove)\s+(.+)$/i);
    if (unmapMatch) {
      const sourceLookup = resolveFieldName(unmapMatch[2], sourceFieldsAll);
      if (!sourceLookup.value) return sourceLookup.error ?? 'Unable to resolve source field.';
      const sourceField = sourceLookup.value;
      const existing = entityMappings[selectedEntity] ?? [];
      const nextMappings = existing.filter((mapping) => mapping.sourceField !== sourceField);
      setEntityMappings((prev) => ({ ...prev, [selectedEntity]: nextMappings }));
      return `Removed mapping for ${sourceField}.`;
    }

    const mapMatch = trimmed.match(/^(map|set|change)\s+(.+?)\s*(?:to|->)\s*(.+)$/i);
    if (mapMatch) {
      const sourceLookup = resolveFieldName(mapMatch[2], sourceFieldsAll);
      if (!sourceLookup.value) return sourceLookup.error ?? 'Unable to resolve source field.';

      const targetLookup = resolveFieldName(mapMatch[3], targetFieldsAll);
      if (!targetLookup.value) return targetLookup.error ?? 'Unable to resolve target field.';

      const sourceField = sourceLookup.value;
      const targetField = targetLookup.value;
      const existing = entityMappings[selectedEntity] ?? [];

      const nextMappings = existing
        .filter((mapping) => mapping.sourceField !== sourceField && mapping.targetField !== targetField)
        .concat([{ sourceField, targetField }]);

      setEntityMappings((prev) => ({ ...prev, [selectedEntity]: nextMappings }));
      return `Mapped ${sourceField} -> ${targetField}.`;
    }

    return 'Unknown command. Use: map <source> to <target>, unmap <source>, auto map, clear mappings, show mappings.';
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text };
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: runChatCommand(text),
    };

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);
    setChatInput('');
  };

  useEffect(() => {
    if (!isDraggingConnection || !scrollAreaRef.current) return;

    const scrollContainer = scrollAreaRef.current.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;
    if (!scrollContainer) return;

    // lock horizontal scroll
    scrollContainer.style.overflowX = 'hidden';

    const onPointerMove = (e: PointerEvent) => {
      lastPointerY.current = e.clientY;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let animationFrame = 0;
    const autoScroll = () => {
      const rect = scrollContainer.getBoundingClientRect();
      const y = lastPointerY.current;
      const edgeThreshold = 80;

      let deltaY = 0;
      if (y < rect.top + edgeThreshold) deltaY = -10;
      else if (y > rect.bottom - edgeThreshold) deltaY = 10;

      if (deltaY !== 0) {
        scrollContainer.scrollTop += deltaY;   // vertical only
        scrollContainer.scrollLeft = 0;        // prevent horizontal drift
      }

      animationFrame = requestAnimationFrame(autoScroll);
    };

    animationFrame = requestAnimationFrame(autoScroll);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [isDraggingConnection]);

  const onConnect: OnConnect = (connection: Connection) => {
    setIsDraggingConnection(false);
    setSelectedEdgeId(null);
    const sourceId = connection.source;
    const targetId = connection.target;
    if (!sourceId || !targetId) return;

    const sourceField = sourceId.startsWith(SOURCE_PREFIX) ? sourceId.slice(SOURCE_PREFIX.length) : null;
    const targetField = targetId.startsWith(TARGET_PREFIX) ? targetId.slice(TARGET_PREFIX.length) : null;
    if (!sourceField || !targetField) return;

    setEntityMappings((prev) => {
      const current = prev[selectedEntity] ?? [];
      const updated: FieldMapping[] = current
        .filter((m) => m.sourceField !== sourceField && m.targetField !== targetField)
        .concat([{ sourceField, targetField }]);
      return { ...prev, [selectedEntity]: updated };
    });
  };

  const onEdgesDelete: OnEdgesDelete = (deleted) => {
    const toRemove = new Set(deleted.map((e) => e.id));
    setSelectedEdgeId((prev) => (prev && toRemove.has(prev) ? null : prev));
    setEntityMappings((prev) => {
      const current = prev[selectedEntity] ?? [];
      const updated = current.filter((m) => !toRemove.has(`e-${m.sourceField}-${m.targetField}`));
      return { ...prev, [selectedEntity]: updated };
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || !selectedEdgeId) return;
      event.preventDefault();
      setEntityMappings((prev) => {
        const current = prev[selectedEntity] ?? [];
        const updated = current.filter((m) => `e-${m.sourceField}-${m.targetField}` !== selectedEdgeId);
        return { ...prev, [selectedEntity]: updated };
      });
      setSelectedEdgeId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEdgeId, selectedEntity]);

  const handleNext = async () => {
    setProcessing(true);
    try {
      const allRowsStr = sessionStorage.getItem('allRows');
      if (!allRowsStr) {
        navigate('/upload');
        return;
      }

      const currentMappings = entityMappings[selectedEntity] ?? [];
      const mappedTargets = new Set(
        currentMappings.filter((m) => m.targetField !== 'Unmapped').map((m) => m.targetField)
      );
      const missingRequired = requiredTargetFields.filter((field) => !mappedTargets.has(field));

      if (missingRequired.length > 0) {
        toast.error(
          `Please map required target fields before proceeding: ${missingRequired.join(', ')}`,
          { position: 'bottom-right' }
        );
        return;
      }

      const allRows = JSON.parse(allRowsStr);
      const baselineMappings = baselineMappingsByEntity[selectedEntity] ?? [];

      const correctionPayload = buildCorrectionPayload(
        selectedEntity,
        currentMappings,
        baselineMappings
      );

      await api.submitMappingCorrections(correctionPayload ?? {
        entityName: selectedEntity,
        submittedAt: new Date().toISOString(),
        mappings: toActiveMappings(currentMappings).map((m) => ({
          sourceField: m.sourceField,
          targetField: m.targetField,
          isManual: false,
        })),
        manualChanges: [],
      });

      const result = await api.processMappedData(currentMappings, allRows);

      sessionStorage.setItem('mappedData', JSON.stringify(result.data));
      sessionStorage.setItem('mappings', JSON.stringify(entityMappings[selectedEntity]));
      sessionStorage.setItem('selectedEntity', selectedEntity);
      sessionStorage.setItem('entityMappings', JSON.stringify(entityMappings));
      sessionStorage.setItem('allEntityMappings', JSON.stringify(entityMappings));
      sessionStorage.setItem('autoMappedCoveragePct', String(autoMappedCoveragePct));

      navigate('/data-preview');
    } catch (error) {
      toast.error('Failed to process mapping. Please try again.', { position: 'bottom-right' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading mappings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_OUTER}>
      <div className={PAGE_CONTAINER}>
        <div className="mb-4">
          <ProcessStepper />
        </div>
        <Card className="shadow-lg border border-border bg-card animate-in">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shadow-sm">
                <GitMerge className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-md font-normal">Map Your Fields</CardTitle>
                <CardDescription className="text-xs ">
                  Drag from a source field handle (left) to a destination field handle (right) to create a mapping.
                  Select a line and press Delete to remove. Target fields marked with <span className='text-red-400'>*</span> are required.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="gap-4 ">
            <div className="text-sm mt-4 font-semibold" >AI Auto-Mapping Summary :</div>
            <div className="rounded-lg border mt-2 mb-4 bg-primary/10 text-blue-900">
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="px-1 flex items-center flex-wrap gap-1 text-xs" >
                  <span className='font-bold'>Summary:</span>
                  <div className="flex items-center gap-1 ">
                    <span>Fields Auto-Mapped:</span>
                    <span >
                      {autoMappedCoveragePct}% ({autoMappedCount}/{targetFieldsAll.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-0 ">
                    <span>Unmapped Columns:</span>
                    <span className="rounded-md px-1 py-0.5 font-semibold">
                      {unmatchedColumnsCount}
                    </span>
                  </div>
                  {/* <div className="flex items-center gap-2 ">
                    <span>Data size overflow warning</span>
                    <span className="rounded-md  px-2 py-0.5 font-semibold">
                      {dataSizeOverflowWarningCount}
                    </span>
                  </div> */}
                  {/* <div className="flex items-center gap-2 ">
                    <span>Data type mismatch</span>
                    <span className="rounded-md  px-2 py-0.5 font-semibold">
                      {dataTypeMismatchCount}
                    </span>
                  </div> */}
                </div>
                {/* <label className="inline-flex items-center gap-2 text-sm text-muted-foreground ml-auto" style={{ minWidth: "150px" }}>
                  <input
                    type="checkbox"
                    checked={showOnlyErrors}
                    onChange={(e) => setShowOnlyErrors(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Show only errors
                </label> */}
              </div>

            </div>

            <div className="relative">
              <div
                className={
                  chatCollapsed
                    ? 'grid grid-cols-1 min-h-[700px]'
                    : 'grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[700px]'
                }
              >
                <div className={chatCollapsed ? 'col-span-1 w-full space-y-4' : 'lg:col-span-3 space-y-4'}>

                  <div
                    ref={flowPaneRef} className="rounded-xl border border-border bg-background overflow-hidden" style={{ background: 'white !important' }}>
                    <div className="grid grid-cols-2 gap-6 px-4 py-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-start text-sm gap-2">
                          <span className="font-semibold text-foreground">
                            Datasets ({selectedEntity || 'Source'}) :
                          </span>
                          <span className="text-muted-foreground">
                            {sourceFieldsAll.length} Columns </span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            id="source-search"
                            type="text"
                            placeholder="Search for field"
                            value={sourceSearch}
                            onChange={(e) => setSourceSearch(e.target.value)}
                            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className='flex justify-between'>
                          <div className="flex items-center justify-start text-sm gap-2">
                            <span className="font-semibold text-foreground">Target Schema :</span>
                            <span className="text-muted-foreground">{mappings.filter((m) => m.targetField !== 'Unmapped').length}/{targetFieldsAll.length} Columns Mapped</span>
                          </div>
                          {/* <div>
                            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground ml-auto" style={{ minWidth: "150px" }}>
                              <input
                                type="checkbox"
                                checked={showOnlyErrors}
                                onChange={(e) => setShowOnlyErrors(e.target.checked)}
                                className="h-4 w-4 rounded border-input"
                              />
                              Show only unmapped
                            </label>
                          </div> */}
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            id="target-search"
                            type="text"
                            placeholder="Search for field"
                            value={targetSearch}
                            onChange={(e) => setTargetSearch(e.target.value)}
                            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer ml-4" style={{ minWidth: "150px" }}>
                              <input
                                type="checkbox"
                                checked={showOnlyErrors}
                                onChange={(e) => setShowOnlyErrors(e.target.checked)}
                                className="h-4 w-4 rounded border-input cursor-pointer accent-primary"
                              />
                              Show only unmapped
                            </label>
                    <ScrollArea
                      ref={scrollAreaRef}
                      className="w-full [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden [&_[data-radix-scroll-area-viewport]]:overflow-y-auto"
                      style={{ height: MAPPING_VIEWPORT_HEIGHT }}
                    >
                      <div
                        className="relative mx-auto"
                        style={{
                          height: mappingContentHeight,
                          width: flowCanvasWidth,
                          minWidth: flowCanvasWidth,
                        }}
                        onPointerMove={(e) => {
                          lastPointerY.current = e.clientY;
                        }}
                      >
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                          onConnect={onConnect}
                          onEdgesDelete={onEdgesDelete}
                          onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
                          onPaneClick={() => setSelectedEdgeId(null)}
                          onConnectStart={() => setIsDraggingConnection(true)}
                          onConnectEnd={() => setIsDraggingConnection(false)}
                          deleteKeyCode={['Backspace', 'Delete']} 
                          isValidConnection={() => true}
                          nodeTypes={NODE_TYPES}
                          zoomOnScroll={false}
                          zoomOnPinch={false}
                          zoomOnDoubleClick={false}
                          panOnDrag={false}
                          panOnScroll={false}
                          preventScrolling={false}
                          minZoom={1}
                          maxZoom={1}
                          nodesDraggable={false}
                          nodesConnectable={true}
                          elementsSelectable={true}
                          edgesReconnectable={false}
                          defaultEdgeOptions={{
                            type: 'default',
                            deletable: true,
                          }}
                           proOptions={{ hideAttribution: true }}
                           defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                           fitView={false}
                           style={{ background: 'transparent' }}
                         >
                          <Background gap={8} size={1} color="#e5e7eb" />
                          {/* <Panel position="top-left" className="m-2 mx-4 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded shadow">
                            {mappings.filter((m) => m.targetField !== 'Unmapped').length} mappings
                          </Panel> */}
                        </ReactFlow>
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {!chatCollapsed && (
                  <div className="lg:col-span-1">
                    <div className="rounded-xl border border-border bg-background h-full flex flex-col">
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-normal text-foreground">Mapping Bot</h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setChatCollapsed(true)}
                          className="h-8 w-8"
                          aria-label="Collapse chatbot"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex-1 p-4 overflow-hidden flex flex-col space-y-3">
                        <ScrollArea className="flex-1 rounded-md border border-border bg-muted/20 p-3">
                          <div className="space-y-2 pr-2">
                            {chatMessages.map((message) => (
                              <div
                                key={message.id}
                                className={`rounded-md px-3 py-2 text-xs ${message.role === 'assistant'
                                  ? 'bg-muted text-foreground'
                                  : 'bg-primary text-primary-foreground ml-auto max-w-[90%]'
                                  }`}
                              >
                                {message.text}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>

                        <p className="text-xs text-muted-foreground">
                          Commands: map &lt;source&gt; to &lt;target&gt;, unmap, auto map, clear, show.
                        </p>

                        <div className="flex gap-2">
                          <Input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a command"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSendChat();
                              }
                            }}
                            className="text-sm"
                          />
                          <Button type="button" onClick={handleSendChat} className="shrink-0 h-9 w-9 p-0">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* {chatCollapsed && (
                <button
                  type="button"
                  onClick={() => setChatCollapsed(false)}
                  className="absolute bottom-6 right-6 z-50 h-12 w-12 rounded-full border shadow-lg bg-primary text-primary-foreground inline-flex items-center justify-center"
                  aria-label="Open chatbot"
                >
                  <Bot className="h-6 w-6 text-white" />
                </button>
              )} */}
            </div>

          </CardContent>
          <div className="flex flex-col sm:flex-row justify-between gap-3 px-6 py-3 border-t bg-muted">
            <Button
              variant="outline"
              onClick={() => navigate('/upload')}
              className="className='border-primary text-primary font-semibold hover:bg-primary/10 transition-colors'"
            >
              <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={processing}
              variant='outline'
              className="w-full sm:w-auto  border-primary text-primary font-semibold order-1 hover:bg-primary/10 transition-colors px-5 pr-3"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Next
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>

        </Card>
      </div>
      {/* Navigation Arrows */}
      <button
        onClick={() => navigate('/upload')}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-3  transition-all duration-200 px-1 rounded-md bg-black opacity-40 text-white shadow-lg"
        title="Previous: Data Preview"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        onClick={handleNext}
        disabled={processing}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 transition-all duration-200 disabled:opacity-50 rounded-md bg-black opacity-40  text-white shadow-lg px-1"
        title="Next: Data Analytics"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}