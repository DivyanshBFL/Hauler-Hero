import { memo, useEffect } from "react";
import { TableCell } from "@/components/ui/table";

export type EditableIssueCellProps = {
  cellKey: string;
  rowIndex: number;
  column: string;
  displayText: string;
  isWorkedOn: boolean;
  hasIssue: boolean;
  isMissingValue: boolean;
  issueTitle?: string;
  isEverEditable: boolean;
  isEditing: boolean;
  editedValue: string;
  setEditedValue: (v: string) => void;
  onStartEdit: (rowIndex: number, column: string, initialValue: string) => void;
  onCommit: (rowIndex: number, column: string, nextValue: string) => void;
  onCancel: () => void;
  markEverEditable: (cellKey: string) => void;
};

export const EditableIssueCell = memo(function EditableIssueCell(
  props: EditableIssueCellProps,
) {
  const {
    cellKey,
    rowIndex,
    column,
    displayText,
    isWorkedOn,
    hasIssue,
    isMissingValue,
    issueTitle,
    isEverEditable,
    isEditing,
    editedValue,
    setEditedValue,
    onStartEdit,
    onCommit,
    onCancel,
    markEverEditable,
  } = props;

  const isEditable = isEverEditable || hasIssue || isMissingValue;

  useEffect(() => {
    if (hasIssue || isMissingValue) {
      markEverEditable(cellKey);
    }
  }, [cellKey, hasIssue, isMissingValue, markEverEditable]);

  let bgClass = "";
  if (hasIssue || isMissingValue) {
    bgClass = "bg-red-50";
  } else if (isWorkedOn) {
    bgClass = "bg-yellow-100";
  }

  return (
    <TableCell
      className={`px-1 py-2 whitespace-nowrap ${bgClass} ${isEditable ? "cursor-pointer bg-clip-content" : "bg-clip-content"}`}
      title={hasIssue ? issueTitle : undefined}
      onClick={() => {
        if (!isEditable) return;
        onStartEdit(rowIndex, column, displayText);
      }}
    >
      {isEditing ? (
        <input
          type="text"
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          onBlur={() => onCommit(rowIndex, column, editedValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onCommit(rowIndex, column, editedValue);
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          autoFocus
          className="w-full px-2 py-1 border border-gray-300 rounded"
        />
      ) : (
        <span style={{ padding: "5px" }}>{displayText || ""}</span>
      )}
    </TableCell>
  );
});

