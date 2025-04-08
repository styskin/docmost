import { Node, Mark, MarkType } from '@tiptap/pm/model';
import { EditorState, Transaction } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

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
  textEnd: number
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

  console.warn("Could not find document range for text positions:", { textStart, textEnd });
  return null;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
}

export function createSuggestionTransaction(
  state: EditorState,
  suggestion: TextSuggestion,
  username: string
): Transaction | null {
  const { schema } = state;

  if (!schema.marks.suggestionDelete || !schema.marks.suggestionInsert) {
      console.error("Schema is missing suggestion marks! Available marks:", Object.keys(schema.marks));
      return null;
  }

  const {
    textToReplace,
    textReplacement = '',
    reason = '',
    textBefore = '',
    textAfter = '',
  } = suggestion;

  const searchText = textBefore + textToReplace + textAfter;
  
  if (searchText.length === 0) {
    console.warn('createSuggestionTransaction: Empty search text.');
    return null;
  }

  const pattern = escapeRegExp(searchText);
  const regex = new RegExp(pattern, 'g');
  const docText = state.doc.textContent;
  
  let match;
  let matches: { index: number; length: number }[] = [];
  let matchCount = 0;
  const MAX_MATCHES = 1000; // Safety limit

  while ((match = regex.exec(docText)) !== null) {
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    matchCount++;
    if (matchCount > MAX_MATCHES) {
      console.warn('createSuggestionTransaction: Too many matches found, stopping.');
      break;
    }
    matches.push({ index: match.index, length: match[0].length });
  }

  if (matches.length === 0) {
    console.warn('createSuggestionTransaction: No match found for pattern:', searchText);
    return null;
  }

  if (matches.length > 1) {
    console.warn('createSuggestionTransaction: Multiple matches found, applying only the first.');
  }

  const applyingMatch = matches[0];
  const textMatchStart = applyingMatch.index + textBefore.length;
  const textMatchEnd = textMatchStart + textToReplace.length;

  const docRange = findDocumentRange(state.doc, textMatchStart, textMatchEnd);

  if (!docRange) {
    console.error('createSuggestionTransaction: Failed to map text positions to document range.');
    return null;
  }

  const { from, to } = docRange;

  // Prepare transaction
  let tr = state.tr;
  const suggestionData = reason ? { reason } : undefined;
  const attributes = { username, data: suggestionData };

  // 1. Mark the text to be replaced as 'suggestionDelete'
  if (from !== to) { // Only add delete mark if text is actually being replaced
    tr = tr.addMark(from, to, schema.marks.suggestionDelete.create(attributes));
  }

  // 2. Insert the replacement text marked as 'suggestionInsert'
  if (textReplacement.length > 0) {
    const insertNode = schema.text(
      textReplacement,
      [schema.marks.suggestionInsert.create(attributes)]
    );
    // Insert *after* the marked-for-deletion text
    tr = tr.insert(to, insertNode);
  } else if (from === to) {
      console.warn('createSuggestionTransaction: Skipping suggestion with empty replace/replacement at the same position.');
      return null;
  }

  // Add meta to potentially prevent this transaction from being re-processed by other plugins
  tr = tr.setMeta('suggestionApplied', true);

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
  to: number
): MarkedRange[] => {
  const markRanges = new Map<Mark, { from: number; to: number }>();

  state.doc.nodesBetween(from, to, (node, pos) => {
    node.marks.forEach((mark) => {
      if (
        mark.type.name === 'suggestionInsert' ||
        mark.type.name === 'suggestionDelete'
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
  event: MouseEvent
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