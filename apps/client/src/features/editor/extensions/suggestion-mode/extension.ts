import { Extension } from "@tiptap/core";
import { SuggestionInsert, SuggestionDelete } from "./marks";
import { suggestionModePlugin } from "./plugin";
import { createSuggestionTransaction } from "./utils";
import { ISuggestion } from "./types";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SuggestionModeOptions {}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMode: {
      setSuggestionMode: (
        suggestions: ISuggestion[] | undefined | null,
        username: string,
      ) => ReturnType;
      unsetSuggestionMode: () => ReturnType;
      applySuggestDiffResults: (
        jsonString: string,
        username: string,
      ) => ReturnType;
    };
  }
}

// Parse suggest_diff tool response JSON into ISuggestion[] format
const parseSuggestDiffResults = (jsonString: string): ISuggestion[] => {
  try {
    // Parse the JSON string to get the response object
    const responseObj = JSON.parse(jsonString);

    // Check if this is a valid suggest_diff response with suggestions array
    if (
      responseObj &&
      responseObj.suggestions &&
      Array.isArray(responseObj.suggestions)
    ) {
      console.log(
        "[parseSuggestDiffResults] Found suggestions array:",
        responseObj.suggestions,
      );
      return responseObj.suggestions;
    }

    // Check if this is a success response from the tool
    if (
      responseObj &&
      responseObj.status === "success" &&
      responseObj.appliedSuggestions > 0
    ) {
      console.log(
        "[parseSuggestDiffResults] Found success response but no suggestions data",
      );
    }

    console.warn(
      "[parseSuggestDiffResults] Could not find valid suggestions in JSON:",
      jsonString,
    );
    return [];
  } catch (error) {
    console.error("[parseSuggestDiffResults] Failed to parse JSON:", error);
    return [];
  }
};

export const SuggestionModeExtension = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {};
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
      applySuggestDiffResults:
        (jsonString, username) =>
        ({ editor, commands }) => {
          console.log("[applySuggestDiffResults] Processing JSON:", jsonString);

          try {
            let suggestions: ISuggestion[] = [];

            // Try to parse the JSON string directly
            suggestions = parseSuggestDiffResults(jsonString);

            if (suggestions.length === 0) {
              console.warn(
                "[applySuggestDiffResults] Could not find suggestions in the provided JSON",
              );
              return false;
            }

            // Use the existing setSuggestionMode command with the parsed suggestions
            return commands.setSuggestionMode(
              suggestions,
              username || "AI Assistant",
            );
          } catch (error) {
            console.error(
              "[applySuggestDiffResults] Error processing suggest diff:",
              error,
            );
            return false;
          }
        },
    };
  },

  addProseMirrorPlugins() {
    return [suggestionModePlugin];
  },
});
