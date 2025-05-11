import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

/**
 * Converts markdown text to TipTap JSON format
 * @param markdown - The markdown text to convert
 * @returns TipTap JSON object
 */
export function markdownToTiptap(markdown: string): any {
  Markdown.configure({
    html: true, // Allow HTML input/output
    tightLists: true, // No <p> inside <li> in markdown output
    tightListClass: "tight", // Add class to <ul> allowing you to remove <p> margins when tight
    bulletListMarker: "-", // <li> prefix in markdown output
    linkify: false, // Create links from "https://..." text
    breaks: false, // New lines (\n) in markdown input are converted to <br>
    transformPastedText: false, // Allow to paste markdown text in the editor
    transformCopiedText: false, // Copied text is transformed to markdown
  });
  const editor = new Editor({
    content: markdown,
    extensions: [StarterKit, Markdown],
  });
  return editor.getJSON();
}
