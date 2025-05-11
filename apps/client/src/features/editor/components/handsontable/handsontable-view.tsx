import {
  NodeViewProps,
  NodeViewWrapper,
  BubbleMenu as BaseBubbleMenu,
  posToDOMRect,
  findParentNode,
} from "@tiptap/react";
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.css";
import { HyperFormula } from "hyperformula";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { Node as PMNode } from "@tiptap/pm/model";
import {
  IconRowInsertBottom,
  IconRowInsertTop,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconRowRemove,
  IconColumnRemove,
  IconTrashX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./handsontable.module.css";

// Register all Handsontable modules
registerAllModules();

// Create a HyperFormula instance
const hyperformulaInstance = HyperFormula.buildEmpty({
  licenseKey: "internal-use-in-handsontable",
});

// Function to adjust cell references in formulas when copying/pasting
// For example, when copying =A1 from B1 to C3, it should become =B3
const adjustCellReferencesInFormula = (
  formula: string,
  rowOffset: number,
  colOffset: number,
): string => {
  if (!formula || (rowOffset === 0 && colOffset === 0)) {
    return formula;
  }

  // Regular expression to match cell references like A1, $A$1, $A1, A$1
  // Captures groups: 1=col absolute ($), 2=col letter, 3=row absolute ($), 4=row number
  const cellRefRegex = /(\$?)([A-Z]+)(\$?)(\d+)/g;

  return formula.replace(
    cellRefRegex,
    (match, colAbs, colLetter, rowAbs, rowNumber) => {
      // If the column reference is absolute (has $), don't adjust it
      let newColLetter = colLetter;
      if (!colAbs && colOffset !== 0) {
        // Convert column letter to number (A=0, B=1, etc.)
        let colNum = 0;
        for (let i = 0; i < colLetter.length; i++) {
          colNum = colNum * 26 + (colLetter.charCodeAt(i) - 64); // 'A' is 65 in ASCII
        }

        // Add the offset
        colNum += colOffset;
        if (colNum < 1) colNum = 1; // Ensure we don't go below A

        // Convert back to letter
        newColLetter = "";
        while (colNum > 0) {
          const remainder = (colNum - 1) % 26;
          newColLetter = String.fromCharCode(65 + remainder) + newColLetter;
          colNum = Math.floor((colNum - 1) / 26);
        }
      }

      // If the row reference is absolute (has $), don't adjust it
      let newRowNumber = parseInt(rowNumber, 10);
      if (!rowAbs && rowOffset !== 0) {
        newRowNumber += rowOffset;
        if (newRowNumber < 1) newRowNumber = 1; // Ensure we don't go below 1
      }

      // Reconstruct the cell reference with the same absolute/relative markers
      return `${colAbs}${newColLetter}${rowAbs}${newRowNumber}`;
    },
  );
};

export default function HandsontableView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, updateAttributes, getPos } = props;
  const hotTableRef = useRef(null);
  // Ensure data is always an array of arrays
  const defaultData = [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];

  const [data, setData] = useState(() => {
    // Check if node.attrs.data exists and is an array
    if (
      node.attrs.data &&
      Array.isArray(node.attrs.data) &&
      node.attrs.data.length > 0
    ) {
      // Ensure each row is also an array
      if (Array.isArray(node.attrs.data[0])) {
        return node.attrs.data;
      }
    }
    return defaultData;
  });

  // Update the node attributes when data changes
  useEffect(() => {
    updateAttributes({
      data: data,
    });
  }, [data, updateAttributes]);

  // Methods for manipulating the table
  const addRowAbove = useCallback(() => {
    const newRow = Array(data[0].length).fill("");
    setData([...data.slice(0, 0), newRow, ...data.slice(0)]);
  }, [data]);

  const addRowBelow = useCallback(() => {
    const newRow = Array(data[0].length).fill("");
    setData([...data, newRow]);
  }, [data]);

  const addColumnLeft = useCallback(() => {
    setData(data.map((row) => ["", ...row]));
  }, [data]);

  const addColumnRight = useCallback(() => {
    setData(data.map((row) => [...row, ""]));
  }, [data]);

  const removeRow = useCallback(() => {
    if (data.length > 1) {
      setData(data.slice(0, -1));
    }
  }, [data]);

  const removeColumn = useCallback(() => {
    if (data[0].length > 1) {
      setData(data.map((row) => row.slice(0, -1)));
    }
  }, [data]);

  const deleteTable = useCallback(() => {
    const pos = getPos();
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + 1 })
      .run();
  }, [editor, getPos]);

  // Handle data change from Handsontable
  const handleChange = useCallback((changes, source) => {
    if (changes && hotTableRef.current && hotTableRef.current.hotInstance) {
      try {
        // Get the current data from the table
        const hot = hotTableRef.current.hotInstance;

        // Create a copy of the current data to preserve formulas
        const rowCount = hot.countRows();
        const colCount = hot.countCols();
        const newData = [];

        // Iterate through all cells to get their raw values
        for (let row = 0; row < rowCount; row++) {
          const rowData = [];
          for (let col = 0; col < colCount; col++) {
            // Get the raw value from the cell metadata or cell value
            const cellMeta = hot.getCellMeta(row, col);
            // If the cell has a formula, use the original formula text
            if (cellMeta.formula) {
              rowData.push("=" + cellMeta.formula);
            } else {
              // Otherwise use the cell value
              const value = hot.getDataAtCell(row, col);
              rowData.push(value);
            }
          }
          newData.push(rowData);
        }

        // Ensure we have valid data (array of arrays)
        if (
          Array.isArray(newData) &&
          newData.length > 0 &&
          Array.isArray(newData[0])
        ) {
          setData(newData);
        }
      } catch (error) {
        console.error("Error updating handsontable data:", error);
      }
    }
  }, []);

  // Function to determine if the bubble menu should be shown
  const shouldShow = useCallback(() => {
    return editor.isEditable && editor.isActive("handsontable");
  }, [editor]);

  // Function to get the position for the bubble menu
  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "handsontable";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  return (
    <NodeViewWrapper className={classes.wrapper}>
      {editor.isEditable && (
        <BaseBubbleMenu
          editor={editor}
          pluginKey="handsontable-menu"
          updateDelay={0}
          tippyOptions={{
            getReferenceClientRect: getReferenceClientRect,
            offset: [0, 15],
            zIndex: 99,
            popperOptions: {
              modifiers: [
                {
                  name: "preventOverflow",
                  enabled: true,
                  options: {
                    altAxis: true,
                    boundary: "clippingParents",
                    padding: 8,
                  },
                },
                {
                  name: "flip",
                  enabled: true,
                  options: {
                    boundary: editor.options.element,
                    fallbackPlacements: ["top", "bottom"],
                    padding: { top: 35, left: 8, right: 8, bottom: -Infinity },
                  },
                },
              ],
            },
          }}
          shouldShow={shouldShow}
        >
          <Group>
            <ActionIcon.Group>
              <Tooltip position="top" label={t("Add row above")}>
                <ActionIcon
                  onClick={addRowAbove}
                  variant="default"
                  size="lg"
                  aria-label={t("Add row above")}
                >
                  <IconRowInsertTop size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Add row below")}>
                <ActionIcon
                  onClick={addRowBelow}
                  variant="default"
                  size="lg"
                  aria-label={t("Add row below")}
                >
                  <IconRowInsertBottom size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Remove row")}>
                <ActionIcon
                  onClick={removeRow}
                  variant="default"
                  size="lg"
                  aria-label={t("Remove row")}
                >
                  <IconRowRemove size={18} />
                </ActionIcon>
              </Tooltip>
            </ActionIcon.Group>

            <ActionIcon.Group>
              <Tooltip position="top" label={t("Add column left")}>
                <ActionIcon
                  onClick={addColumnLeft}
                  variant="default"
                  size="lg"
                  aria-label={t("Add column left")}
                >
                  <IconColumnInsertLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Add column right")}>
                <ActionIcon
                  onClick={addColumnRight}
                  variant="default"
                  size="lg"
                  aria-label={t("Add column right")}
                >
                  <IconColumnInsertRight size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Remove column")}>
                <ActionIcon
                  onClick={removeColumn}
                  variant="default"
                  size="lg"
                  aria-label={t("Remove column")}
                >
                  <IconColumnRemove size={18} />
                </ActionIcon>
              </Tooltip>
            </ActionIcon.Group>

            <Tooltip position="top" label={t("Delete table")}>
              <ActionIcon
                onClick={deleteTable}
                variant="default"
                size="lg"
                color="red"
                aria-label={t("Delete table")}
              >
                <IconTrashX size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </BaseBubbleMenu>
      )}

      <div className={classes.tableContainer}>
        <HotTable
          ref={hotTableRef}
          data={data}
          rowHeaders={true}
          colHeaders={true}
          filters={true}
          dropdownMenu={true}
          height="auto"
          licenseKey="non-commercial-and-evaluation"
          afterChange={handleChange}
          readOnly={!editor.isEditable}
          contextMenu={editor.isEditable}
          manualColumnResize={editor.isEditable}
          manualRowResize={editor.isEditable}
          formulas={{
            engine: hyperformulaInstance,
          }}
          // Enable preserving raw cell values
          allowInsertRow={true}
          allowInsertColumn={true}
          // Add custom cell type to handle formulas
          cells={(row, col) => {
            return {
              // This ensures we can edit the raw formula text
              renderer: "text",
              // Preserve the raw input value
              allowInvalid: true,
              // Keep original formula input
              copyable: true,
            };
          }}
          beforeChange={(changes, source) => {
            // Preserve formulas when editing
            if (changes && hotTableRef.current) {
              const hot = hotTableRef.current.hotInstance;

              // Check if this is a paste operation with multiple changes
              const isPaste =
                source &&
                source.toString() === "CopyPaste.paste" &&
                changes.length > 1;
              let pasteStartRow = 0;
              let pasteStartCol = 0;

              if (
                isPaste &&
                changes[0] &&
                Array.isArray(changes[0]) &&
                changes[0].length >= 2
              ) {
                // Get the starting position of the paste operation
                pasteStartRow =
                  typeof changes[0][0] === "number" ? changes[0][0] : 0;
                pasteStartCol =
                  typeof changes[0][1] === "number" ? changes[0][1] : 0;
              }

              for (let i = 0; i < changes.length; i++) {
                if (!Array.isArray(changes[i]) || changes[i].length < 4)
                  continue;

                const row =
                  typeof changes[i][0] === "number" ? changes[i][0] : 0;
                const col =
                  typeof changes[i][1] === "number" ? changes[i][1] : 0;
                const oldValue = changes[i][2];
                const newValue = changes[i][3];

                // If the new value starts with '=', process it as a formula
                if (typeof newValue === "string" && newValue.startsWith("=")) {
                  let formulaText = newValue.substring(1); // Remove the '=' prefix

                  // For paste operations, adjust cell references
                  if (isPaste) {
                    // Calculate the offset from the paste start position
                    const rowOffset = Number(row) - Number(pasteStartRow);
                    const colOffset = Number(col) - Number(pasteStartCol);

                    if (rowOffset > 0 || colOffset > 0) {
                      // Adjust cell references in the formula using Excel-style reference adjustment
                      formulaText = adjustCellReferencesInFormula(
                        formulaText,
                        rowOffset,
                        colOffset,
                      );
                    }
                  }

                  // Store the formula in cell metadata
                  const cellMeta = hot.getCellMeta(row, col);
                  cellMeta.formula = formulaText;
                  hot.setCellMeta(row, col, "formula", formulaText);

                  // Update the change with the adjusted formula
                  changes[i][3] = "=" + formulaText;
                }
              }
            }
            return true; // Allow the changes
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}
