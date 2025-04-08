import { Extension } from '@tiptap/core';
import { SuggestionInsert, SuggestionDelete } from './marks';
import { suggestionModePlugin } from './plugin';

export interface SuggestionModeOptions {
  // Add options here if needed in the future
}

export const SuggestionModeExtension = Extension.create<SuggestionModeOptions>({
  name: 'suggestionMode',

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

  addProseMirrorPlugins() {
    return [suggestionModePlugin];
  }
}); 