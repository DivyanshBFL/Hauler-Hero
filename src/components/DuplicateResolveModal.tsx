import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Check, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: Map<string, any[]>;
  onMerge: (originalRecords: any[], mergedRecord: any) => void;
};

export const DuplicateResolveModal = ({
  isOpen,
  onClose,
  duplicateGroups,
  onMerge
}: Props) => {
  const currentGroupIndex = 0;
  const [mergedValues, setMergedValues] = useState<Record<string, any>>({});
  
  const groupKeys = Array.from(duplicateGroups.keys());
  const currentKey = groupKeys[currentGroupIndex];
  const currentRecords = duplicateGroups.get(currentKey) || [];

  // Initialize mergedValues with the first record when group changes
  useEffect(() => {
    if (currentRecords.length > 0) {
      setMergedValues({ ...currentRecords[0] });
    }
  }, [currentKey, currentRecords]);

  // Headers excluding internal/hidden fields if any (assumed all keys in row are valid headers)
  const headers = currentRecords.length > 0 ? Object.keys(currentRecords[0]) : [];

  const handleValueSelect = (field: string, value: any) => {
    setMergedValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // When a merge happens, the parent removes the current group from the map.
  // So the list shrinks, and the next item falls into the current index (or we stay at 0 if we process sequentially).
  // We shouldn't increment index if we are effectively removing the head.
  // However, to keep it simple and stateless regarding "total", we can just always show the first item?
  // But the progress bar needs to know.
  // Let's assume the parent REMOVES the item.
  
  const handleMergeAndNext = () => {
    onMerge(currentRecords, mergedValues);
    // Don't increment index, because the current key will be removed, 
    // and the next key will slide into the current index (or index 0).
    // If we are at the end, the modal will close because groupKeys.length becomes 0.
  };

  // Calculate progress based on how many we started with vs how many are left?
  // We don't have the initial count here unless passed. 
  // For now, let's just show "Remaining: X"
  const totalRemaining = groupKeys.length;

  if (!isOpen || groupKeys.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col p-0 gap-0 bg-slate-50 dark:bg-slate-900 border-none shadow-2xl overflow-hidden focus:outline-none">
        
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Resolve Duplicates
              </DialogTitle>
              <DialogDescription className="mt-1">
                Resolving duplicates • <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{currentKey}</span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
               <User className="h-4 w-4" /> 
               {currentRecords.length} duplicates found
            </div>
          </div>
          

        </DialogHeader>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_300px]">
            
            {/* Left: Comparison Table */}
            <ScrollArea className="h-full border-r bg-white dark:bg-slate-950">
                <div className="p-6 min-w-max">
                  <div className="grid gap-x-8 gap-y-1" 
                       style={{ 
                         gridTemplateColumns: `auto repeat(${currentRecords.length}, minmax(200px, 1fr))` 
                       }}>
                    
                    {/* Header Row */}
                    <div className="font-semibold text-sm text-muted-foreground sticky top-0 bg-white dark:bg-slate-950 py-2 z-10 border-b mb-2">Field</div>
                    {currentRecords.map((_, idx) => (
                      <div key={idx} className="font-semibold text-sm text-center text-blue-600 dark:text-blue-400 sticky top-0 bg-white dark:bg-slate-950 py-2 z-10 border-b mb-2">
                        Record {idx + 1}
                      </div>
                    ))}

                    {/* Data Rows */}
                    {headers.map(field => {
                        const uniqueValues = new Set(currentRecords.map(r => r[field]));
                        const isConflict = uniqueValues.size > 1;

                        return (
                        <div key={field} className="contents group">
                            <div className="py-3 text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 flex items-center">
                                {field}
                                {isConflict && <span className="ml-2 w-1.5 h-1.5 rounded-full bg-orange-500" title="Values differ" />}
                            </div>
                            
                            {currentRecords.map((record, idx) => {
                                const isSelected = mergedValues[field] === record[field];
                                return (
                                <div 
                                    key={idx} 
                                    onClick={() => handleValueSelect(field, record[field])}
                                    className={cn(
                                        "py-2 px-3 text-sm border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all duration-200 rounded-md my-1",
                                        "hover:bg-slate-50 dark:hover:bg-slate-900 border",
                                        isSelected 
                                            ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900 shadow-sm"
                                            : "border-transparent opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate block" title={String(record[field])}>{record[field]}</span>
                                        {isSelected && <Check className="h-3 w-3 text-blue-600 flex-shrink-0" />}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )})}
                  </div>
                </div>
            </ScrollArea>

            {/* Right: Merged Result Preview */}
            <div className="bg-slate-50 dark:bg-slate-900/50 flex flex-col h-full border-l min-h-0">
                 <div className="p-4 bg-white dark:bg-slate-950 border-b font-semibold text-sm flex items-center justify-center text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4 mr-2" />
                    Merged Result Preview
                 </div>
                 <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                        {headers.map(field => (
                            <div key={field} className="bg-white dark:bg-slate-950 p-3 rounded-lg border shadow-sm text-sm">
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{field}</div>
                                <div className="font-medium truncate" title={String(mergedValues[field])}>
                                    {mergedValues[field] || <span className="text-muted-foreground italic">Empty</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                 </ScrollArea>
            </div>

        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-white dark:bg-slate-950">
          <div className="flex justify-between w-full items-center">
            <div className="text-xs text-muted-foreground">
                {totalRemaining > 1 ? `${totalRemaining} groups remaining` : "Last group"}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button 
                    onClick={handleMergeAndNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
                >
                    {totalRemaining > 1 ? "Merge & Next" : "Merge & Finish"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
