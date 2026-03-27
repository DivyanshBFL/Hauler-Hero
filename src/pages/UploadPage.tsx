import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, X, ChevronRight } from "lucide-react";
import { PAGE_OUTER, PAGE_CONTAINER } from "@/constants/layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SheetData } from "@/services/api";
import ProcessStepper from "@/components/ProcessStepper";
import Loader from "@/components/Loader";

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
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [sheetHeadersByName, setSheetHeadersByName] = useState<
    Record<string, string[]>
  >({});
  const [isJoinRequired, setIsJoinRequired] = useState(false);
  const [joinSelection, setJoinSelection] = useState<JoinSelection | null>(
    null,
  );
  const [leftSheetName, setLeftSheetName] = useState("");
  const [rightSheetName, setRightSheetName] = useState("");
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [leftSheetQuery, setLeftSheetQuery] = useState("");
  const [rightSheetQuery, setRightSheetQuery] = useState("");
  const [leftKeyQuery, setLeftKeyQuery] = useState("");
  const [rightKeyQuery, setRightKeyQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const navigate = useNavigate();

  const resetUploadState = () => {
    setFile(null);
    setSheets([]);
    setAllRows([]);
    setShowSheetSelector(false);
    setAvailableSheetNames([]);
    setSheetHeadersByName({});
    setIsJoinRequired(false);
    setJoinSelection(null);
    setLeftSheetName("");
    setRightSheetName("");
    setLeftKey("");
    setRightKey("");
    setLeftSheetQuery("");
    setRightSheetQuery("");
    setLeftKeyQuery("");
    setRightKeyQuery("");
    workbookRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    setLeftSheetName("");
    setRightSheetName("");
    setLeftKey("");
    setRightKey("");
    setLeftSheetQuery("");
    setRightSheetQuery("");
    setLeftKeyQuery("");
    setRightKeyQuery("");
    workbookRef.current = null;

    const fileType = selectedFile.type;
    const fileName = selectedFile.name;
    const isCSV = fileType === "text/csv" || fileName.endsWith(".csv");
    const isXLSX =
      fileType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fileName.endsWith(".xlsx");

    if (isCSV) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else if (isXLSX) {
      setFile(selectedFile);
      parseXLSX(selectedFile);
    } else {
      toast.error("Please select a valid CSV or XLSX file");
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
            name: "Account",
            headers,
            rows: rows.slice(0, 10),
          },
        ];

        setSheets(sheetsData);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        toast.error("Error parsing CSV file");
        resetUploadState();
      },
    });
  };

  const getSheetRowsAndHeaders = (
    workbook: XLSX.WorkBook,
    sheetName: string,
  ) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
      raw: false,
    });
    let headers = Object.keys(rows[0] || {});

    if (!headers.length) {
      const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
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
        const workbook = XLSX.read(data, { type: "array" });
        workbookRef.current = workbook;
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 1) {
          setIsJoinRequired(false);
          setJoinSelection(null);
          processXLSXSheet(workbook, sheetNames[0]);
        } else {
          const headersBySheet = sheetNames.reduce<Record<string, string[]>>(
            (acc, name) => {
              acc[name] = getSheetRowsAndHeaders(workbook, name).headers;
              return acc;
            },
            {},
          );

          const firstSheet = sheetNames[0] ?? "";
          const secondSheet = sheetNames[1] ?? "";

          setIsJoinRequired(true);
          setAvailableSheetNames(sheetNames);
          setSheetHeadersByName(headersBySheet);
          setLeftSheetName(firstSheet);
          setRightSheetName(secondSheet);
          setLeftKey(headersBySheet[firstSheet]?.[0] ?? "");
          setRightKey(headersBySheet[secondSheet]?.[0] ?? "");
          setLeftSheetQuery("");
          setRightSheetQuery("");
          setLeftKeyQuery("");
          setRightKeyQuery("");
          requestAnimationFrame(() => setShowSheetSelector(true));
        }
      } catch (error) {
        console.error("Error parsing XLSX:", error);
        toast.error("Error parsing XLSX file");
        resetUploadState();
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
          name: "Account",
          headers,
          rows: rows.slice(0, 10),
        },
      ];

      setSheets(sheetsData);
      setShowSheetSelector(false);
    } catch (error) {
      console.error("Error processing sheet:", error);
      toast.error("Error processing sheet");
      resetUploadState();
    }
  };

  const handleConfirmJoinSelection = () => {
    if (!workbookRef.current) {
      toast.error("Workbook is not available. Please re-upload the file.");
      return;
    }

    if (!leftSheetName || !rightSheetName || !leftKey || !rightKey) {
      toast.error("Please select both sheets and keys before continuing.");
      return;
    }

    const leftHeaders = sheetHeadersByName[leftSheetName] ?? [];
    const rightHeaders = sheetHeadersByName[rightSheetName] ?? [];

    if (
      !availableSheetNames.includes(leftSheetName) ||
      !availableSheetNames.includes(rightSheetName)
    ) {
      toast.error("Please choose valid sheet names from the dropdown options.");
      return;
    }

    if (!leftHeaders.includes(leftKey) || !rightHeaders.includes(rightKey)) {
      toast.error("Please choose valid join keys from the dropdown options.");
      return;
    }

    if (leftSheetName === rightSheetName) {
      toast.error("Please select two different sheets for join.");
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
      toast.error("Please configure sheet join before proceeding.");
      return;
    }

    sessionStorage.setItem("sheets", JSON.stringify(sheets));
    sessionStorage.setItem("allRows", JSON.stringify(allRows));

    if (isJoinRequired && joinSelection) {
      sessionStorage.setItem("joinSelection", JSON.stringify(joinSelection));
      sessionStorage.setItem(
        "sheetHeadersByName",
        JSON.stringify(sheetHeadersByName),
      );
    } else {
      sessionStorage.removeItem("joinSelection");
      sessionStorage.removeItem("sheetHeadersByName");
    }

    navigate("/field-mapping", {
      state: {
        fileToUpload: file,
        entityName: sheets[0]?.name ?? "string",
      },
    });
  };

  const canProceed =
    file && sheets.length > 0 && (!isJoinRequired || Boolean(joinSelection));
  const effectiveLeftSheet = availableSheetNames.includes(leftSheetName)
    ? leftSheetName
    : "";
  const rightSheetOptions = availableSheetNames.filter(
    (name) => name !== effectiveLeftSheet,
  );
  const effectiveRightSheet = rightSheetOptions.includes(rightSheetName)
    ? rightSheetName
    : (rightSheetOptions[0] ?? "");
  const leftSheetHeaders = sheetHeadersByName[effectiveLeftSheet] ?? [];
  const rightSheetHeaders = sheetHeadersByName[effectiveRightSheet] ?? [];
  const isLeftKeyValid = leftSheetHeaders.includes(leftKey);
  const isRightKeyValid = rightSheetHeaders.includes(rightKey);
  const filteredLeftSheets = availableSheetNames;
  const filteredRightSheets = rightSheetOptions;
  const filteredLeftKeys = leftSheetHeaders;
  const filteredRightKeys = rightSheetHeaders;

  return (
    <>
      <div className={`${PAGE_OUTER} !min-h-[30rem]`}>
        <div className={`${PAGE_CONTAINER} min-h-[30rem]`}>
          <div className="mb-2">
            <ProcessStepper />
          </div>
          <Card className="shadow-none border border-border bg-card animate-in flex flex-col relative">
            <CardHeader className="p-1 px-2 bg-muted border-none shrink-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shadow-sm">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm font-normal">
                        Upload File
                      </CardTitle>
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
                    <CardDescription className=" text-muted-foreground text-[11px]">
                      {sheets.length > 0 ? (
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
                                <div
                                  key={sheet.name}
                                  className="group "
                                  style={{ animationDelay: `${index * 100}ms` }}
                                >
                                  <div className="">
                                    <div>
                                      File Summary: {allRows.length} rows with{" "}
                                      {sheet.headers.length} column(s).
                                      {/* <span className="text-xs">
                                      Identified{" "}
                                      <span className="">
                                        {sheet.headers.length} columns
                                      </span>{" "}
                                      and{" "}
                                      <span className="">
                                        {allRows.length} rows
                                      </span>{" "}
                                      in this selected file.
                                    </span> */}
                                      {isJoinRequired && joinSelection && (
                                        <span className="text-[11px] ml-1">
                                          Join Configured:{" "}
                                          <span className="">
                                            {joinSelection.leftSheet}
                                          </span>{" "}
                                          (
                                          <span className="">
                                            {joinSelection.leftKey}
                                          </span>
                                          ) {"->"}{" "}
                                          <span className="">
                                            {joinSelection.rightSheet}
                                          </span>{" "}
                                          (
                                          <span className="">
                                            {joinSelection.rightKey}
                                          </span>
                                          )
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          Upload your source CSV or XLSX file to begin the data
                          processing workflow
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="float-right">
                  {file && (
                    <div className="flex gap-2">
                      {availableSheetNames.length > 1 && (
                        <Button
                          variant="outline"
                          className="font-normal text-xs border-primary text-primary hover:bg-primary/10 transition-colors hover:text-primary py-1"
                          onClick={() => {
                            setShowSheetSelector(true);
                          }}
                        >
                          Re-Join Sheets
                        </Button>
                      )}
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

            <CardContent className={`p-0  flex flex-col flex-1 ${file?"":"justify-center min-h-[29rem]"}`}>
              <div className="flex justify-center flex-col items-center w-full h-full">
                {/* pb-4 */}
                {!file && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                    w-full max-w-3xl relative group flex flex-col items-center justify-center gap-3 p-6 
                    rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer
                    ${
                      isDragging
                        ? "border-primary bg-primary/10 scale-[1.02] shadow-2xl"
                        : "border-primary/40 bg-primary/[0.03] hover:border-primary/60 hover:bg-primary/[0.06]"
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

                    <div className="text-center space-y-2 ">
                      <h3 className="text-md font-normal text-foreground tracking-tight">
                        Drop your file here
                      </h3>
                      <p className="text-sm font-normal  text-muted-foreground  opacity-60">
                        Or Click To Browse
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="relative overflow-hidden px-3 h-10 border-primary text-primary hover:bg-primary/10 font-bold rounded-md shadow-primary/10 transition-all active:scale-95"
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
                        <div
                          key={sheet.name}
                          className="group "
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="max-h-[415px] overflow-auto">
                            <Table className="w-full min-w-[900px] ">
                              <TableHeader className=" font-bold text-sm ">
                                <TableRow>
                                  {previewHeaders.map((header) => (
                                    <TableHead
                                      key={header}
                                      className="px-3 py-[0.35rem] text-left font-semibold whitespace-nowrap bg-gray-50 border border-border"
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
                                        {String(
                                          (row as Record<string, unknown>)?.[
                                            header
                                          ] ?? "",
                                        )}
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
            {canProceed && (
              <div className="flex justify-end p-1 px-2 border-t bg-muted shrink-0">
                <Button
                  onClick={handleNext}
                  disabled={false}
                  variant="outline"
                  className="px-5 pr-3 font-semibold border-primary text-primary hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                >
                  Next
                  <svg
                    className="ml-2 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </div>
            )}
          </Card>

          <Dialog
            open={showSheetSelector}
            onOpenChange={(open) => {
              setShowSheetSelector(open);
              if (!open && sheets.length === 0) {
                resetUploadState();
              }
            }}
          >
            <DialogContent
              className="w-[50vw] max-w-[80vw] p-0 !animate-none 
          !duration-0 overflow-hidden gap-0"
            >
              <DialogHeader className="border-b p-4 bg-muted space-y-0">
                <DialogTitle className="text-md">
                  Select Sheets To Join
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Pick two different sheets and choose a join key for each.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-[22vw_2vw_22vw]  p-4 ">
                {/* Left Side */}
                <div className="rounded-lg space-y-3 ">
                  {/* <div className="text-sm font-semibold text-foreground">Primary Data</div> */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Primary Sheet
                    </label>
                    <Select
                      value={leftSheetName}
                      onValueChange={(nextLeft) => {
                        setLeftSheetName(nextLeft);
                        const nextRightOptions = availableSheetNames.filter(
                          (n) => n !== nextLeft,
                        );
                        const nextRight =
                          nextLeft === rightSheetName
                            ? (nextRightOptions[0] ?? "")
                            : rightSheetName;
                        setRightSheetName(nextRight);
                        setLeftKey(sheetHeadersByName[nextLeft]?.[0] ?? "");
                        setRightKey(sheetHeadersByName[nextRight]?.[0] ?? "");
                      }}
                    >
                      <SelectTrigger className="w-full h-9 rounded-sm border-gray-200 bg-background px-3 text-xs font-normal shadow-none hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="Select primary sheet" />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm border-gray-200 shadow-md">
                        {filteredLeftSheets.map((name) => (
                          <SelectItem
                            key={name}
                            value={name}
                            className="text-xs rounded-sm"
                          >
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Column
                    </label>
                    <Select
                      value={leftKey}
                      onValueChange={(val) => setLeftKey(val)}
                      disabled={!effectiveLeftSheet}
                    >
                      <SelectTrigger className="w-full h-9 rounded-sm border-gray-200 bg-background px-3 text-xs font-normal shadow-none hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm border-gray-200 shadow-md">
                        {filteredLeftKeys.map((h) => (
                          <SelectItem
                            key={h}
                            value={h}
                            className="text-xs rounded-sm"
                          >
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div
                    className=""
                    style={{
                      width: "1px",
                      background: "#d2d2d2",
                    }}
                  ></div>
                </div>
                {/* Right Side */}
                <div className="rounded-lg space-y-3 ">
                  {/* <div className="text-sm font-semibold text-foreground">Seconday Data</div> */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Reference Sheet
                    </label>
                    <Select
                      value={rightSheetName}
                      onValueChange={(nextRight) => {
                        setRightSheetName(nextRight);
                        setRightKey(sheetHeadersByName[nextRight]?.[0] ?? "");
                      }}
                    >
                      <SelectTrigger className="w-full h-9 rounded-sm border-gray-200 bg-background px-3 text-xs font-normal shadow-none hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="Select reference sheet" />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm border-gray-200 shadow-md">
                        {filteredRightSheets.map((name) => (
                          <SelectItem
                            key={name}
                            value={name}
                            className="text-xs rounded-sm"
                          >
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Related Column
                    </label>
                    <Select
                      value={rightKey}
                      onValueChange={(val) => setRightKey(val)}
                      disabled={!effectiveRightSheet}
                    >
                      <SelectTrigger className="w-full h-9 rounded-sm border-gray-200 bg-background px-3 text-xs font-normal shadow-none hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="Select related column" />
                      </SelectTrigger>
                      <SelectContent className="rounded-sm border-gray-200 shadow-md">
                        {filteredRightKeys.map((h) => (
                          <SelectItem
                            key={h}
                            value={h}
                            className="text-xs rounded-sm"
                          >
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="w-full border-b"></div>
              <div className="flex gap-2 bg-muted p-4 py-2 justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    resetUploadState();
                    setShowSheetSelector(false);
                  }}
                  variant="outline"
                  className="h-9 text-xs px-5 font-semibold transition-colors"
                >
                  Cancel
                </Button>
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
                  className="font-semibold border-primary text-primary hover:bg-primary/10 hover:text-primary transition-colors h-9 text-xs px-5"
                >
                  Confirm Join Selection
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {/* Next Arrow - Only show if file is ready */}
        {canProceed && (
          <button
            onClick={handleNext}
            disabled={false}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-30 p-3  transition-all duration-200 px-1 rounded-md bg-black opacity-40 text-white shadow-lg"
            title="Next: Field Mapping"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </>
  );
}
