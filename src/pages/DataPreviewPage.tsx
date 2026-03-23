import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/services/api';
import { Loader2, Download,ChevronLeft, ChevronRight,FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { FieldMapping } from '@/services/api';
import { PAGE_OUTER, PAGE_CONTAINER } from '@/constants/layout';
import ProcessStepper from '@/components/ProcessStepper';

const ENTITIES = ['Account', 'Contact', 'Opportunity'];

export function DataPreviewPage() {
  const [allEntityData, setAllEntityData] = useState<Record<string, any[]>>({});
  const [allEntityMappings, setAllEntityMappings] = useState<Record<string, FieldMapping[]>>({});
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  // ── derive headers + rows from selectedEntity ────────────────
  const currentRows = useMemo(() => allEntityData[selectedEntity] ?? [], [allEntityData, selectedEntity]);
  const currentHeaders = useMemo(() => (currentRows[0] ? Object.keys(currentRows[0]) : []), [currentRows]);
  const previewRows = currentRows.slice(0, 20);

  // ── available tabs: entities that have data ──────────────────
  const availableTabs = useMemo(
    () => ENTITIES.filter((e) => (allEntityData[e]?.length ?? 0) > 0),
    [allEntityData]
  );

  const totalRows = useMemo(
    () => availableTabs.reduce((sum, e) => sum + (allEntityData[e]?.length ?? 0), 0),
    [availableTabs, allEntityData]
  );

  useEffect(() => {
    const loadData = async () => {
      const allRowsStr = sessionStorage.getItem('allRows');
      const allMappingsStr = sessionStorage.getItem('allEntityMappings');

      if (!allRowsStr) { navigate('/upload'); return; }

      const allRows = JSON.parse(allRowsStr) as any[];

      if (allMappingsStr) {
        const allMappings = JSON.parse(allMappingsStr) as Record<string, FieldMapping[]>;
        setAllEntityMappings(allMappings);

        const entityDataMap: Record<string, any[]> = {};

        for (const entity of ENTITIES) {
          if (allMappings[entity]?.length) {
            const result = await api.processMappedData(allMappings[entity], allRows);
            entityDataMap[entity] = result.data;
          }
        }

        setAllEntityData(entityDataMap);

        const firstAvailable =
          (sessionStorage.getItem('selectedEntity') ?? '') in entityDataMap
            ? (sessionStorage.getItem('selectedEntity') as string)
            : (ENTITIES.find((e) => entityDataMap[e]?.length) ?? '');

        setSelectedEntity(firstAvailable);
      }

      setLoading(false);
    };

    void loadData();
  }, [navigate]);

  // ── handleNext ───────────────────────────────────────────────
  const handleNext = async () => {
    setProcessing(true);
    try {
      const allData = ENTITIES.flatMap((entity) => allEntityData[entity] ?? []);
      if (!allData.length) { alert('No mapped data available to process.'); return; }
      navigate('/data-cleaning', { state: { selectedMappedRows: allData } });
    } finally {
      setProcessing(false);
    }
  };

  // ── Excel download ───────────────────────────────────────────
  const handleDownloadExcel = () => {
    if (!currentRows.length) return;
    const ws = XLSX.utils.json_to_sheet(currentRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedEntity);
    XLSX.writeFile(wb, `preview_${selectedEntity}_${Date.now()}.xlsx`);
  };

  // ── Mapping JSON download ────────────────────────────────────
  const handleDownloadMappingJSON = () => {
    const mapping = allEntityMappings[selectedEntity] ?? [];
    const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mapping_${selectedEntity}_${Date.now()}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── PDF ──────────────────────────────────────────────────────
  const generateMappingPDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF();
      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const marginX = 15;
      const marginBottom = 20;

      // Title Page
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data Mapping Report', pageWidth / 2, 40, { align: 'center' });

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 55, { align: 'center' });

      // Loop through all entities
      for (const entity of ENTITIES) {
        // Filter data based on checked rows
        const entityMappings = allEntityMappings[entity] || [];
        const allEntityRows = allEntityData[entity] || [];

        pdf.addPage();
        yPosition = 20;

        // Entity Header
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(66, 133, 244);
        pdf.text(`Entity: ${entity}`, marginX, yPosition);
        yPosition += 10;

        pdf.setDrawColor(66, 133, 244);
        pdf.setLineWidth(0.5);
        pdf.line(marginX, yPosition, pageWidth - marginX, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);

        pdf.text(`Total Mappings: ${entityMappings.length}`, marginX, yPosition);
        yPosition += 6;
        pdf.text(`Total Records: ${allEntityRows.length}`, marginX, yPosition);
        yPosition += 12;

        // Field Mappings Section
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Field Mappings', marginX, yPosition);
        yPosition += 8;

        // Mappings Table
        pdf.setFontSize(10);
        const col1Width = 80;
        const col2Width = 80;
        const tableStartX = marginX;

        // Table Header
        pdf.setFillColor(66, 133, 244);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.rect(tableStartX, yPosition, col1Width, 8, 'F');
        pdf.rect(tableStartX + col1Width, yPosition, col2Width, 8, 'F');
        pdf.text('Source Field', tableStartX + 2, yPosition + 5.5);
        pdf.text('Target Field', tableStartX + col1Width + 2, yPosition + 5.5);

        yPosition += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');

        // Table Data Rows
        entityMappings.forEach((mapping, index) => {
          if (yPosition > pageHeight - marginBottom) {
            pdf.addPage();
            yPosition = 20;
          }

          const bgColor = index % 2 === 0 ? 245 : 255;
          pdf.setFillColor(bgColor, bgColor, bgColor);
          pdf.rect(tableStartX, yPosition, col1Width, 7, 'F');
          pdf.rect(tableStartX + col1Width, yPosition, col2Width, 7, 'F');

          // Draw borders
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.1);
          pdf.rect(tableStartX, yPosition, col1Width, 7);
          pdf.rect(tableStartX + col1Width, yPosition, col2Width, 7);

          const sourceText = mapping.sourceField.length > 35 ? mapping.sourceField.substring(0, 32) + '...' : mapping.sourceField;
          const targetText = mapping.targetField.length > 35 ? mapping.targetField.substring(0, 32) + '...' : mapping.targetField;

          pdf.text(sourceText, tableStartX + 2, yPosition + 5);
          pdf.text(targetText, tableStartX + col1Width + 2, yPosition + 5);

          yPosition += 7;
        });

        yPosition += 10;

        // Data Preview Section
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Data Preview', marginX, yPosition);
        yPosition += 8;

        if (allEntityRows.length > 0) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');

          const previewHeaders = Object.keys(allEntityRows[0]);
          const tableWidth = pageWidth - 2 * marginX - 5;
          const colWidth = tableWidth / previewHeaders.length;
          const cellPadding = 1.5;

          const wrapText = (text: string, width: number) =>
            pdf.splitTextToSize(text, width);

          // Header row
          pdf.setFillColor(66, 133, 244);
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');

          const headerLineCounts = previewHeaders.map((header) =>
            wrapText(header, colWidth - 2 * cellPadding).length
          );
          const headerMaxLines = Math.max(1, ...headerLineCounts);
          const headerHeight = Math.max(7, headerMaxLines * 4);
          if (yPosition + headerHeight > pageHeight - marginX) {
            pdf.addPage();
            yPosition = marginX;
          }
          previewHeaders.forEach((header, i) => {
            const x = marginX + i * colWidth;
            pdf.setFillColor(66, 133, 244);
            pdf.rect(x, yPosition, colWidth, headerHeight, 'F');

            // Add border to header cells
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.3);
            pdf.rect(x, yPosition, colWidth, headerHeight);

            const headerLines = wrapText(header, colWidth - 2 * cellPadding);

            pdf.setTextColor(255, 255, 255);
            pdf.text(headerLines, x + cellPadding, yPosition + 4, {
              maxWidth: colWidth - 2 * cellPadding,
            });
          });

          yPosition += headerHeight;
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');

          // Data rows
          allEntityRows.forEach((row, rowIndex) => {
            const lineCounts = previewHeaders.map((header) => {
              const value = String(row[header] ?? '');
              return wrapText(value, colWidth - 2 * cellPadding).length;
            });
            const maxLines = Math.max(1, ...lineCounts);
            const rowHeight = Math.max(6, maxLines * 4);

            if (yPosition + rowHeight > pageHeight - marginBottom) {
              pdf.addPage();
              yPosition = 20;
            }

            const bgColor = rowIndex % 2 === 0 ? 245 : 255;

            previewHeaders.forEach((header, colIndex) => {
              const x = marginX + colIndex * colWidth;
              pdf.setFillColor(bgColor, bgColor, bgColor);
              pdf.rect(x, yPosition, colWidth, rowHeight, 'F');

              pdf.setDrawColor(200, 200, 200);
              pdf.setLineWidth(0.1);
              pdf.rect(x, yPosition, colWidth, rowHeight);

              const value = String(row[header] ?? '');
              const lines = wrapText(value, colWidth - 2 * cellPadding);
              pdf.setTextColor(0, 0, 0);
              pdf.text(lines, x + cellPadding, yPosition + 4, {
                maxWidth: colWidth - 2 * cellPadding,
              });
            });

            yPosition += rowHeight;
          });
        } else {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(128, 128, 128);
          pdf.text('No data available for preview', marginX, yPosition);
        }
      }

      // Save PDF
      pdf.save(`complete_mapping_report_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading data preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_OUTER}>
      <div className={PAGE_CONTAINER}>
        <div className="mb-4"><ProcessStepper /></div>

        <Card className="shadow-lg border border-border bg-card">
          <CardHeader className="">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <CardTitle className="">Mapped Data Preview</CardTitle>
                  <CardDescription className="mt-0">
                    Showing first 20 rows per entity &mdash; all&nbsp;
                    <span className="font-medium text-foreground">{totalRows}</span>
                    &nbsp;mapped rows will be processed
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
  
                <Button variant="outline" onClick={handleDownloadExcel} disabled={!currentRows.length} className="">
                  <FileDown className="mr-2 h-4 w-4" />Excel
                </Button>
                <Button variant="outline" onClick={handleDownloadMappingJSON} disabled={!(allEntityMappings[selectedEntity]?.length)} className="">
                  <Download className="mr-2 h-4 w-4" />JSON
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* ── Entity tabs ─────────────────────────────────── */}
            {availableTabs.length > 1 && (
              <div className="flex gap-1 border-b border-border">
                {availableTabs.map((entity) => (
                  <button
                    key={entity}
                    onClick={() => setSelectedEntity(entity)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedEntity === entity
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {entity}
                    <span className="ml-2 text-xs bg-muted rounded-full px-2 py-0.5">
                      {allEntityData[entity]?.length ?? 0} rows
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Table ────────────────────────────────────────── */}
            <div className="border border-border rounded-xs overflow-hidden shadow-sm bg-card mt-6">
              <div className="max-h-[60vh] overflow-auto">
                {previewRows.length > 0 ? (
                  <Table className="w-full text-sm">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow>
                        {currentHeaders.map((h) => (
                          <TableHead
                            key={h}
                            className="font-semibold px-3 py-2 text-muted-foreground bg-muted whitespace-nowrap"
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIndex) => (
                        <TableRow
                          key={rowIndex}
                          className=" hover:bg-muted/50 transition-colors"
                        >
                          {currentHeaders.map((h) => (
                            <TableCell key={h} className="whitespace-nowrap px-3 py-2">
                              {row[h] ?? '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center text-muted-foreground text-sm">
                    No mapped data available for <strong>{selectedEntity}</strong>.
                  </div>
                )}
              </div>
            </div>

            {currentRows.length > 20 && (
              <p className="text-xs text-muted-foreground text-right">
                Showing 20 of {currentRows.length} rows — all rows will be included when processing
              </p>
            )}
          </CardContent>

          <div className="flex flex-col sm:flex-row justify-between gap-3 px-6 py-3 border-t bg-muted">
            <Button variant="outline" onClick={() => navigate('/field-mapping')} className="w-full sm:w-auto">
              <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={processing || !totalRows}
              className="w-full sm:w-auto px-8 h-11 font-semibold"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Review Issues
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
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-primary/80 hover:bg-primary text-primary-foreground shadow-lg transition-all duration-200"
        title="Previous: Upload"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        onClick={handleNext}
        disabled={processing}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-primary/80 hover:bg-primary text-primary-foreground shadow-lg transition-all duration-200 disabled:opacity-50"
        title="Next: Data Cleaning"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}