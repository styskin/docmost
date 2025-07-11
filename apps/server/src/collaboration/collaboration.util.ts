import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Youtube } from '@tiptap/extension-youtube';
import Table from '@tiptap/extension-table';
import TableHeader from '@tiptap/extension-table-header';
import {
  Callout,
  Comment,
  CustomCodeBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  LinkExtension,
  MathBlock,
  MathInline,
  TableCell,
  TableRow,
  TiptapImage,
  TiptapVideo,
  TrailingNode,
  Attachment,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Manul,
  Handsontable,
} from '@docmost/editor-ext';
import { generateText, getSchema, JSONContent, Mark } from '@tiptap/core';
import { generateHTML } from '../common/helpers/prosemirror/html';
// @tiptap/html library works best for generating prosemirror json state but not HTML
// see: https://github.com/ueberdosis/tiptap/issues/5352
// see:https://github.com/ueberdosis/tiptap/issues/4089
import { generateJSON } from '@tiptap/html';
import { Node } from '@tiptap/pm/model';

// Define placeholder marks for server-side schema validation
const SuggestionInsertMark = Mark.create({
  name: 'suggestionInsert',
});

const SuggestionDeleteMark = Mark.create({
  name: 'suggestionDelete',
});

export const tiptapExtensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Comment,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem,
  Underline,
  LinkExtension,
  Superscript,
  SubScript,
  Highlight,
  Typography,
  TrailingNode,
  TextStyle,
  Color,
  MathInline,
  MathBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  Youtube,
  TiptapImage,
  TiptapVideo,
  Callout,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Manul,
  Handsontable,
  SuggestionInsertMark,
  SuggestionDeleteMark,
] as any;

// Function to recursively sanitize Tiptap JSON content
function sanitizeNode(node: any): any {
  if (!node) {
    return null;
  }

  if (node.type === 'manul') {
    return null; // Remove manul nodes
  }

  if (Array.isArray(node.content)) {
    // Recursively sanitize content array, filtering out nulls from removed nodes
    node.content = node.content.map(sanitizeNode).filter((n) => n !== null);
  }

  if (Array.isArray(node.marks)) {
    // Recursively check marks as well, although 'manul' is unlikely here
    node.marks = node.marks.map(sanitizeNode).filter((n) => n !== null);
  }

  return node;
}

export function sanitizeTiptapJson(
  tiptapJson: JSONContent | null,
): JSONContent | null {
  if (!tiptapJson || typeof tiptapJson !== 'object') {
    return tiptapJson;
  }
  // Deep clone to avoid modifying the original object
  const clonedJson = JSON.parse(JSON.stringify(tiptapJson));
  return sanitizeNode(clonedJson);
}

export function jsonToHtml(tiptapJson: any) {
  return generateHTML(tiptapJson, tiptapExtensions);
}

export function htmlToJson(html: string) {
  return generateJSON(html, tiptapExtensions);
}

export function jsonToText(tiptapJson: JSONContent) {
  return generateText(tiptapJson, tiptapExtensions);
}

export function jsonToNode(tiptapJson: JSONContent) {
  return Node.fromJSON(getSchema(tiptapExtensions), tiptapJson);
}

export function getPageId(documentName: string) {
  return documentName.split('.')[1];
}
