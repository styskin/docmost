import { Node, Mark, MarkType } from "@tiptap/pm/model";
import { EditorState, Transaction } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

export interface TextSuggestion {
  textToReplace: string;
  textReplacement: string;
  reason?: string;
  textBefore?: string;
  textAfter?: string;
}

function findDocumentRange(
  doc: Node,
  textStart: number,
  textEnd: number,
): { from: number; to: number } | null {
  let currentTextPos = 0;
  let startPos: number | null = null;
  let endPos: number | null = null;

  // Walk through all text nodes in the document
  doc.descendants((node, nodeStartPos) => {
    if (startPos !== null && endPos !== null) return false;

    if (node.isText) {
      const nodeTextEndPos = currentTextPos + (node.text?.length || 0);

      if (
        startPos === null &&
        textStart >= currentTextPos &&
        textStart <= nodeTextEndPos
      ) {
        const offsetInNode = textStart - currentTextPos;
        startPos = nodeStartPos + offsetInNode;
      }

      if (
        endPos === null &&
        textEnd >= currentTextPos &&
        textEnd <= nodeTextEndPos
      ) {
        const offsetInNode = textEnd - currentTextPos;
        endPos = nodeStartPos + offsetInNode;
      }

      currentTextPos = nodeTextEndPos;
    }
    return true;
  });

  if (startPos !== null && endPos !== null) {
    return { from: startPos, to: endPos };
  }

  console.warn("Could not find document range for text positions:", {
    textStart,
    textEnd,
  });
  return null;
}

function escapeRegExp(string: string): string {
  const escaped = string.replace(/[.*+?^${}()]/g, "\\$&");
  return escaped;
}

export function createSuggestionTransaction(
  state: EditorState,
  suggestionInput: TextSuggestion,
  username: string,
): Transaction | null {
  console.log(
    "[createSuggestionTransaction] Received suggestionInput:",
    suggestionInput,
  );

  const { schema } = state;

  if (!schema.marks.suggestionDelete || !schema.marks.suggestionInsert) {
    console.error(
      "Schema is missing suggestion marks! Available marks:",
      Object.keys(schema.marks),
    );
    return null;
  }

  const textToReplace = suggestionInput.textToReplace ?? "";
  const textReplacement = suggestionInput.textReplacement ?? "";
  const reason = suggestionInput.reason ?? "";
  const textBefore = suggestionInput.textBefore ?? "";
  const textAfter = suggestionInput.textAfter ?? "";

  const escapedBefore = escapeRegExp(textBefore);
  const escapedReplace = escapeRegExp(textToReplace);
  const escapedAfter = escapeRegExp(textAfter);

  const processedBefore = escapedBefore.replace(/\n/g, "\\s*");
  const processedReplace = escapedReplace.replace(/\n/g, "\\s*");
  const processedAfter = escapedAfter.replace(/\n/g, "\\s*");


  const patternText = processedBefore + "\\s*(" + processedReplace + ")\\s*" + processedAfter;

  console.log(
    "[createSuggestionTransaction] Constructed pattern string:",
    patternText,
  );

  if (
    escapedReplace.length === 0 &&
    escapedBefore.length === 0 &&
    escapedAfter.length === 0
  ) {
    console.warn(
      "createSuggestionTransaction: All context parts are empty after escaping and defaulting."
    );
    return null;
  }

  const regex = new RegExp(patternText, "g");
  console.log("[createSuggestionTransaction] Constructed Regex object:", regex);
  const docText = state.doc.textContent;
  console.log(
    "[createSuggestionTransaction] Searching within docText:",
    docText.substring(0, 500) + "...",
  );

  let match = null;
  const matches: {
    index: number;
    length: number;
    replaceIndex: number;
    replaceLength: number;
  }[] = [];
  let matchCount = 0;
  const MAX_MATCHES = 1000;

  while ((match = regex.exec(docText)) !== null) {
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    matchCount++;
    if (matchCount > MAX_MATCHES) {
      console.warn(
        "createSuggestionTransaction: Too many matches found, stopping.",
      );
      break;
    }

    const fullMatchText = match[0];
    const replaceMatchText = match[1] || "";
    const replaceIndexInFull = fullMatchText.indexOf(replaceMatchText);

    if (replaceIndexInFull === -1 && textToReplace.length > 0) {
      console.warn(
        "createSuggestionTransaction: Regex matched, but could not reliably locate the capture group for textToReplace within the full match. Skipping.",
        {
          fullMatchText,
          pattern: patternText,
          expectedCapture: textToReplace.replace(/\n/g, "\\s*"),
        },
      );
      continue;
    }

    matches.push({
      index: match.index,
      length: fullMatchText.length,
      replaceIndex: Math.max(0, replaceIndexInFull),
      replaceLength: replaceMatchText.length,
    });
  }

  if (matches.length === 0) {
    console.warn(
      "[createSuggestionTransaction] No match found for pattern string:",
      patternText,
    );
    return null;
  }

  if (matches.length > 1) {
    console.warn(
      "createSuggestionTransaction: Multiple matches found, applying only the first valid one.",
    );
  }

  const applyingMatch = matches[0];
  const textMatchStart = applyingMatch.index + applyingMatch.replaceIndex;
  const textMatchEnd = textMatchStart + textToReplace.length;

  console.log(
    `Mapping text positions ${textMatchStart}-${textMatchEnd} to doc range...`,
  );
  const docRange = findDocumentRange(state.doc, textMatchStart, textMatchEnd);

  if (!docRange) {
    console.error(
      "createSuggestionTransaction: Failed to map text positions to document range.",
    );
    return null;
  }

  const { from, to } = docRange;

  let tr = state.tr;
  const markAttributesData = reason ? { reason } : undefined;
  const attributes = { username, data: markAttributesData };

  if (from !== to) {
    tr = tr.addMark(from, to, schema.marks.suggestionDelete.create(attributes));
  }

  if (textReplacement.length > 0) {
    const insertNode = schema.text(textReplacement, [
      schema.marks.suggestionInsert.create(attributes),
    ]);
    tr = tr.insert(to, insertNode);
  } else if (from === to) {
    console.warn(
      "createSuggestionTransaction: Skipping suggestion with empty replace/replacement at the same position.",
    );
    return null;
  }

  tr = tr.setMeta("suggestionApplied", true);
  return tr;
}

interface MarkedRange {
  mark: Mark;
  from: number;
  to: number;
}

const findSuggestionsInRange = (
  state: EditorState,
  from: number,
  to: number,
): MarkedRange[] => {
  const markRanges = new Map<Mark, { from: number; to: number }>();

  state.doc.nodesBetween(from, to, (node, pos) => {
    node.marks.forEach((mark) => {
      if (
        mark.type.name === "suggestionInsert" ||
        mark.type.name === "suggestionDelete"
      ) {
        const range = markRanges.get(mark) || { from: pos, to: pos };
        range.from = Math.min(range.from, pos);
        range.to = Math.max(range.to, pos + node.nodeSize);
        markRanges.set(mark, range);
      }
    });
  });

  return Array.from(markRanges.entries()).map(([mark, range]) => ({
    mark,
    from: range.from,
    to: range.to,
  }));
};

export const findHoverTarget = (
  view: EditorView,
  event: MouseEvent,
): { from: number; to: number; markType: MarkType } | null => {
  const coords = { left: event.clientX, top: event.clientY };
  const posData = view.posAtCoords(coords);
  if (!posData) return null;

  const pos = posData.pos;
  const markedRanges = findSuggestionsInRange(view.state, pos, pos);

  if (markedRanges.length > 0) {
    const targetMark = markedRanges[0];
    return {
      from: targetMark.from,
      to: targetMark.to,
      markType: targetMark.mark.type,
    };
  }

  return null;
};
