import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  EditorState,
  Transaction,
  TextSelection,
} from "@tiptap/pm/state";
import {
  createSuggestionTransaction,
  TextSuggestion,
} from "./suggestion-mode/utils";

export const goReplacementPluginKey = new PluginKey("goReplacementPlugin");

// Define the Tiptap Extension
export const GoReplacementExtension = Extension.create({
  name: "goReplacement",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: goReplacementPluginKey,
        state: {
          init() {
            return {};
          },
          apply(tr, value) {
            return value;
          },
        },
        appendTransaction(
          transactions: readonly Transaction[],
          oldState: EditorState,
          newState: EditorState,
        ): Transaction | null {
          let textChanged = false;
          transactions.forEach((transaction) => {
            if (
              transaction.docChanged &&
              !transaction.getMeta("suggestionApplied")
            ) {
              textChanged = true;
            }
          });

          if (!textChanged) {
            return null;
          }

          const { selection } = newState;
          if (
            !(selection instanceof TextSelection) ||
            !selection.empty ||
            selection.$cursor === null
          ) {
            return null;
          }

          const cursorPos = selection.$cursor.pos;
          const textBeforeTrigger = newState.doc.textBetween(
            Math.max(0, cursorPos - 3),
            cursorPos,
          );

          if (textBeforeTrigger === "GO!") {
            const suggestion: TextSuggestion = {
              textToReplace: "GO!",
              textReplacement: "Suggestion Applied!",
              reason: "GO! Trigger",
              textBefore: newState.doc.textBetween(
                Math.max(0, cursorPos - 13),
                cursorPos - 3,
              ),
              textAfter: newState.doc.textBetween(
                cursorPos,
                Math.min(newState.doc.content.size, cursorPos + 10),
              ),
            };

            const suggestionTr = createSuggestionTransaction(
              newState,
              suggestion,
              "GoPlugin",
            );

            if (suggestionTr) {
              return suggestionTr;
            } else {
            }
          }

          return null;
        },
      }),
    ];
  },
});
