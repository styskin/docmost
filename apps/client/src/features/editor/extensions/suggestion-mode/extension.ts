import { Extension } from "@tiptap/core";
import { SuggestionInsert, SuggestionDelete } from "./marks";
import { suggestionModePlugin } from "./plugin";
import { ISuggestion } from "@/features/comment/types/comment.types";
import { createSuggestionTransaction } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SuggestionModeOptions {
  // Add options here if needed in the future
}

// Define the command structure we expect
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMode: {
      setSuggestionMode: (
        suggestions: ISuggestion[] | undefined | null,
        username: string,
      ) => ReturnType;
      unsetSuggestionMode: () => ReturnType;
    };
  }
}

export const SuggestionModeExtension = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      // Default options
    };
  },

  addMarks() {
    return {
      suggestionInsert: SuggestionInsert,
      suggestionDelete: SuggestionDelete,
    };
  },

  addCommands() {
    return {
      setSuggestionMode:
        (suggestions, username) =>
        ({ editor, commands }) => {
          console.log(
            "[setSuggestionMode] Received raw suggestions array:",
            suggestions,
          );

          if (!suggestions || suggestions.length === 0) {
            console.warn("setSuggestionMode called with no suggestions.");
            return false;
          }

          const effectiveUsername = username || "AI Assistant";

          console.log(
            `Applying ${suggestions.length} suggestions as ${effectiveUsername}...`,
          );

          let success = true;
          for (const suggestionItem of suggestions) {
            const currentEditorState = editor.state;
            const suggestionTr = createSuggestionTransaction(
              currentEditorState,
              suggestionItem,
              effectiveUsername,
            );

            if (suggestionTr) {
              editor.view.dispatch(suggestionTr);
            } else {
              console.warn(
                "Could not create transaction for suggestion:",
                suggestionItem,
              );
              success = false;
            }
          }

          console.log("Finished applying suggestions.");
          return success;
        },
      unsetSuggestionMode:
        () =>
        ({ editor, commands }) => {
          console.log("Placeholder: unsetSuggestionMode called");
          const { from, to } = editor.state.selection;
          const fullRange = { from: 0, to: editor.state.doc.content.size };
          return (
            commands.setTextSelection(fullRange) &&
            commands.unsetMark("suggestionInsert") &&
            commands.unsetMark("suggestionDelete") &&
            commands.setTextSelection({ from, to })
          );
        },
    };
  },

  addProseMirrorPlugins() {
    return [suggestionModePlugin];
  },
});
