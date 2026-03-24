import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, X, ChevronRight } from 'lucide-react';
import { PAGE_OUTER, PAGE_CONTAINER } from '@/constants/layout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SheetData } from '@/services/api';
import ProcessStepper from '@/components/ProcessStepper';
import { joinSheets, mapFields, uploadFile } from '@/services/api';
import { setSessionId } from '@/store/sessionSlice';

type JoinSelection = {
  leftSheet: string;
  rightSheet: string;
  leftKey: string;
  rightKey: string;
};

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [sheetHeadersByName, setSheetHeadersByName] = useState<Record<string, string[]>>({});
  const [isJoinRequired, setIsJoinRequired] = useState(false);
  const [joinSelection, setJoinSelection] = useState<JoinSelection | null>(null);
  const [leftSheetName, setLeftSheetName] = useState('');
  const [rightSheetName, setRightSheetName] = useState('');
  const [leftKey, setLeftKey] = useState('');
  const [rightKey, setRightKey] = useState('');
  const [leftSheetQuery, setLeftSheetQuery] = useState('');
  const [rightSheetQuery, setRightSheetQuery] = useState('');
  const [leftKeyQuery, setLeftKeyQuery] = useState('');
  const [rightKeyQuery, setRightKeyQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const resetUploadState = () => {
    setFile(null);
    setSheets([]);
    setAllRows([]);
    setShowSheetSelector(false);
    setAvailableSheetNames([]);
    setSheetHeadersByName({});
    setIsJoinRequired(false);
    setJoinSelection(null);
    setLeftSheetName('');
    setRightSheetName('');
    setLeftKey('');
    setRightKey('');
    setLeftSheetQuery('');
    setRightSheetQuery('');
    setLeftKeyQuery('');
    setRightKeyQuery('');
    workbookRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processSelectedFile(selectedFile);
  };

  const processSelectedFile = (selectedFile: File) => {
    setSheets([]);
    setAllRows([]);
    setShowSheetSelector(false);
    setAvailableSheetNames([]);
    setSheetHeadersByName({});
    setIsJoinRequired(false);
    setJoinSelection(null);
    setLeftSheetName('');
    setRightSheetName('');
    setLeftKey('');
    setRightKey('');
    setLeftSheetQuery('');
    setRightSheetQuery('');
    setLeftKeyQuery('');
    setRightKeyQuery('');
    workbookRef.current = null;

    const fileType = selectedFile.type;
    const fileName = selectedFile.name;
    const isCSV = fileType === 'text/csv' || fileName.endsWith('.csv');
    const isXLSX =
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileName.endsWith('.xlsx');

    if (isCSV) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else if (isXLSX) {
      setFile(selectedFile);
      parseXLSX(selectedFile);
    } else {
      alert('Please select a valid CSV or XLSX file');
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as any[];

        setAllRows(rows);
        setShowSheetSelector(false);
        setIsJoinRequired(false);
        setJoinSelection(null);

        const sheetsData: SheetData[] = [
          {
            name: 'Account',
            headers,
            rows: rows.slice(0, 10),
          },
        ];

        setSheets(sheetsData);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file');
      },
    });
  };

  const getSheetRowsAndHeaders = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    let headers = Object.keys(rows[0] || {});

    if (!headers.length) {
      const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: '',
      });
      headers = (matrix[0] || [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0);
    }

    return { rows, headers };
  };

  const parseXLSX = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        workbookRef.current = workbook;
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 1) {
          setIsJoinRequired(false);
          setJoinSelection(null);
          processXLSXSheet(workbook, sheetNames[0]);
        } else {
          const headersBySheet = sheetNames.reduce<Record<string, string[]>>((acc, name) => {
            acc[name] = getSheetRowsAndHeaders(workbook, name).headers;
            return acc;
          }, {});

          const firstSheet = sheetNames[0] ?? '';
          const secondSheet = sheetNames[1] ?? '';

          setIsJoinRequired(true);
          setAvailableSheetNames(sheetNames);
          setSheetHeadersByName(headersBySheet);
          setLeftSheetName(firstSheet);
          setRightSheetName(secondSheet);
          setLeftKey(headersBySheet[firstSheet]?.[0] ?? '');
          setRightKey(headersBySheet[secondSheet]?.[0] ?? '');
          setLeftSheetQuery('');
          setRightSheetQuery('');
          setLeftKeyQuery('');
          setRightKeyQuery('');
          requestAnimationFrame(() => setShowSheetSelector(true));
        }
      } catch (error) {
        console.error('Error parsing XLSX:', error);
        alert('Error parsing XLSX file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processXLSXSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const { rows, headers } = getSheetRowsAndHeaders(workbook, sheetName);

      setAllRows(rows);

      const sheetsData: SheetData[] = [
        {
          name: 'Account',
          headers,
          rows: rows.slice(0, 10),
        },
      ];

      setSheets(sheetsData);
      setShowSheetSelector(false);
    } catch (error) {
      console.error('Error processing sheet:', error);
      alert('Error processing sheet');
    }
  };

  const handleConfirmJoinSelection = () => {
    if (!workbookRef.current) {
      alert('Workbook is not available. Please re-upload the file.');
      return;
    }

    if (!leftSheetName || !rightSheetName || !leftKey || !rightKey) {
      alert('Please select both sheets and keys before continuing.');
      return;
    }

    const leftHeaders = sheetHeadersByName[leftSheetName] ?? [];
    const rightHeaders = sheetHeadersByName[rightSheetName] ?? [];

    if (!availableSheetNames.includes(leftSheetName) || !availableSheetNames.includes(rightSheetName)) {
      alert('Please choose valid sheet names from the dropdown options.');
      return;
    }

    if (!leftHeaders.includes(leftKey) || !rightHeaders.includes(rightKey)) {
      alert('Please choose valid join keys from the dropdown options.');
      return;
    }

    if (leftSheetName === rightSheetName) {
      alert('Please select two different sheets for join.');
      return;
    }

    setJoinSelection({
      leftSheet: leftSheetName,
      rightSheet: rightSheetName,
      leftKey,
      rightKey,
    });

    processXLSXSheet(workbookRef.current, leftSheetName);
    setShowSheetSelector(false);
  };

  const handleNext = async () => {
    if (!file || sheets.length === 0) return;
    if (isJoinRequired && !joinSelection) {
      alert('Please configure sheet join before proceeding.');
      return;
    }

    setLoading(true);
    try {
      const entityName = sheets[0]?.name ?? 'string';

      const uploadResponse = await uploadFile(file);
      const sessionId = uploadResponse?.session_id;

      if (!sessionId) {
        throw new Error('session_id was not returned from /upload-file');
      }

      dispatch(setSessionId(sessionId));
      sessionStorage.setItem('session_id', sessionId);

      if (isJoinRequired && joinSelection) {
        await joinSheets({
          session_id: sessionId,
          left_sheet: joinSelection.leftSheet,
          right_sheet: joinSelection.rightSheet,
          left_key: joinSelection.leftKey,
          right_key: joinSelection.rightKey,
        });

        sessionStorage.setItem('joinSelection', JSON.stringify(joinSelection));
        sessionStorage.setItem('sheetHeadersByName', JSON.stringify(sheetHeadersByName));
      } else {
        sessionStorage.removeItem('joinSelection');
        sessionStorage.removeItem('sheetHeadersByName');
      }

      const mappingResponse = await mapFields({
        session_id: sessionId,
        entityName,
      });

      sessionStorage.setItem('sheets', JSON.stringify(sheets));
      sessionStorage.setItem('allRows', JSON.stringify(allRows));
      sessionStorage.setItem('mappingResponse', JSON.stringify(mappingResponse));

      navigate('/field-mapping');
    } catch (error) {
      console.error('Error uploading file, joining sheets, or fetching mappings:', error);
      alert('Failed to upload file, join sheets, or fetch field mappings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = file && sheets.length > 0 && (!isJoinRequired || Boolean(joinSelection));
  const effectiveLeftSheet = availableSheetNames.includes(leftSheetName) ? leftSheetName : '';
  const rightSheetOptions = availableSheetNames.filter((name) => name !== effectiveLeftSheet);
  const effectiveRightSheet = rightSheetOptions.includes(rightSheetName)
    ? rightSheetName
    : rightSheetOptions[0] ?? '';
  const leftSheetHeaders = sheetHeadersByName[effectiveLeftSheet] ?? [];
  const rightSheetHeaders = sheetHeadersByName[effectiveRightSheet] ?? [];
  const isLeftKeyValid = leftSheetHeaders.includes(leftKey);
  const isRightKeyValid = rightSheetHeaders.includes(rightKey);
  const filteredLeftSheets = availableSheetNames;
  const filteredRightSheets = rightSheetOptions;
  const filteredLeftKeys = leftSheetHeaders;
  const filteredRightKeys = rightSheetHeaders;

  return (
    <div className={`${PAGE_OUTER} !min-h-0`}>
      <div className={PAGE_CONTAINER}>
        <div className="mb-4">
          <ProcessStepper />
        </div>
        <Card className="shadow-lg border border-border bg-card animate-in">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shadow-sm">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-md font-normal">Upload File</CardTitle>
                    {/* {file && (
                      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium animate-in fade-in slide-in-from-left-2">
                        <span>📄 {file.name}</span>
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-red-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetUploadState();
                          }}
                        />
                      </div>
                    )} */}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Upload your source CSV or XLSX file to begin the data processing workflow
                  </CardDescription>
                </div>

              </div>
              <div className='float-right'>
                      {file && (
                        <div className='flex gap-2'>
                        <Button variant='outline'
                        className="px-5 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors"
                        onClick={()=>{setShowSheetSelector(true)}}
                        >
                          Remap
                        </Button>
                      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-sm text-xs font-medium animate-in fade-in slide-in-from-left-2">
                        <span>📄 {file.name}</span>
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-red-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetUploadState();
                          }}
                          />
                          </div>
                      </div>
                    )}
                </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 pt-0 pb-0 my-5">
            <div className="flex justify-center flex-col items-center">
              {!file && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    w-full max-w-3xl relative group flex flex-col items-center justify-center gap-3 p-6 
                    rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
                    ${isDragging
                      ? 'border-primary bg-primary/10 scale-[1.02] shadow-2xl'
                      : 'border-primary/40 bg-primary/[0.03] hover:border-primary/60 hover:bg-primary/[0.06]'
                    }
                  `}
                  onClick={openFilePicker}
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300 bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-normal text-foreground tracking-tight">Drop your file here</h3>
                    <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase opacity-60">OR CLICK TO BROWSE</p>
                  </div>

                  <Button
                    variant="outline"
                    className="relative overflow-hidden px-3 h-10 border-primary text-primary hover:bg-primary/10 font-bold rounded-md shadow-lg shadow-primary/10 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5" />
                      Choose File (CSV Or XLSX)
                    </div>
                  </Button>

                  <input
                    type="file"
                    accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {sheets.length > 0 && (
              <>
                <div className="gap-4 mt-0">
                  {sheets.map((sheet, index) => {
                    const previewHeaders = sheet.headers ?? [];
                    const previewRows = allRows.slice(0, 20);

                    return (
                      // <div
                      //   key={sheet.name}
                      //   className="group p-5 border border-border rounded-xl bg-card hover:shadow-md transition-all hover:border-primary/40"
                      //   style={{ animationDelay: `${index * 100}ms` }}
                      // >
                      //       
                      <div key={sheet.name}
                        className="group "
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className=" gap-4">
                          <div className="text-sm font-semibold" >Data Preview :</div>
                          <div className="bg-primary/10 text-blue-900 border border-blue-300 px-2 py-1 rounded-md w-full mt-2">

                            <span className='text-xs'>
                              Identified <span className="font-semibold">{sheet.headers.length} columns</span> and{' '}
                              <span className="font-semibold">{allRows.length} rows</span> in this uploaded file.
                            </span>

                          {isJoinRequired && joinSelection && (
                            <span className="text-xs">
                             Join configured: <span className="font-semibold">{joinSelection.leftSheet}</span>
                            {' '}(<span className="font-semibold">{joinSelection.leftKey}</span>) {'->'}{' '}
                            <span className="font-semibold">{joinSelection.rightSheet}</span>
                            {' '}(<span className="font-semibold">{joinSelection.rightKey}</span>)
                          </span>
                          )}


                          </div>
                        </div>

                        {/* {isJoinRequired && joinSelection && (
                          <div className="mt-3 rounded-md border border-blue-300 bg-primary/10 px-2 py-2 text-xs text-blue-900 ">
                            Join configured: <span className="font-semibold">{joinSelection.leftSheet}</span>
                            {' '}(<span className="font-semibold">{joinSelection.leftKey}</span>) {'->'}{' '}
                            <span className="font-semibold">{joinSelection.rightSheet}</span>
                            {' '}(<span className="font-semibold">{joinSelection.rightKey}</span>)
                          </div>
                        )} */}

                        <div className="mt-4 max-h-96 rounded-md border border-border overflow-auto">
                          <Table className="w-full min-w-[900px] ">
                            <TableHeader className=" font-bold text-sm ">
                              <TableRow>
                                {previewHeaders.map((header) => (
                                  <TableHead
                                    key={header}
                                    className="px-3 py-2 text-left font-medium  whitespace-nowrap bg-gray-50"
                                  >
                                    {header}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.map((row, rowIndex) => (
                                <TableRow key={rowIndex} className="">
                                  {previewHeaders.map((header) => (
                                    <TableCell
                                      key={`${rowIndex}-${header}`}
                                      className="px-3 py-2 whitespace-nowrap"
                                    >
                                      {String((row as Record<string, unknown>)?.[header] ?? '')}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>


              </>
            )}
          </CardContent>
          <div className="flex justify-end px-6 py-3 border-t bg-muted">
            <Button onClick={handleNext} disabled={loading || !canProceed} variant="outline" className="px-5 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Next
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </Card>

        <Dialog open={showSheetSelector} onOpenChange={(open) => setShowSheetSelector(open)}>
          <DialogContent className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 data-[state=open]:animate-none data-[state=closed]:animate-none p-0">
            <DialogHeader className='border-b p-4'>
              <DialogTitle>Select Sheets To Join</DialogTitle>
              <DialogDescription>
                Pick two different sheets and choose a join key for each.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Left Side */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                {/* <div className="text-sm font-semibold text-foreground">Primary Data</div> */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Primary Sheet</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={leftSheetName}
                    onChange={(e) => {
                      const nextLeft = e.target.value;
                      setLeftSheetName(nextLeft);
                      const nextRightOptions = availableSheetNames.filter((n) => n !== nextLeft);
                      const nextRight = nextLeft === rightSheetName ? nextRightOptions[0] ?? '' : rightSheetName;
                      setRightSheetName(nextRight);
                      setLeftKey(sheetHeadersByName[nextLeft]?.[0] ?? '');
                      setRightKey(sheetHeadersByName[nextRight]?.[0] ?? '');
                    }}
                  >
                    {filteredLeftSheets.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Column</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={leftKey}
                    onChange={(e) => setLeftKey(e.target.value)}
                    disabled={!effectiveLeftSheet}
                  >
                    {filteredLeftKeys.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Side */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                {/* <div className="text-sm font-semibold text-foreground">Seconday Data</div> */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reference Sheet</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={rightSheetName}
                    onChange={(e) => {
                      const nextRight = e.target.value;
                      setRightSheetName(nextRight);
                      setRightKey(sheetHeadersByName[nextRight]?.[0] ?? '');
                    }}
                  >
                    {filteredRightSheets.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Related Column</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={rightKey}
                    onChange={(e) => setRightKey(e.target.value)}
                    disabled={!effectiveRightSheet}
                  >
                    {filteredRightKeys.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
<div className='w-full border-b'></div>
            <Button
              type="button"
              onClick={handleConfirmJoinSelection}
              disabled={
                !effectiveLeftSheet ||
                !effectiveRightSheet ||
                !isLeftKeyValid ||
                !isRightKeyValid ||
                effectiveLeftSheet === effectiveRightSheet
              }
                variant="outline" 
                className="px-5 h-11 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 transition-colors max-w-[300px] mx-auto mb-4 "
            >
              Confirm Join Selection
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      {/* Next Arrow - Only show if file is ready */}
      {canProceed && (
        <button
          onClick={handleNext}
          disabled={loading}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-primary/80 hover:bg-primary text-primary-foreground shadow-lg transition-all duration-200 disabled:opacity-50"
          title="Next: Field Mapping"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}