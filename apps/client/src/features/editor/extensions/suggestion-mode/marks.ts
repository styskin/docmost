import { Mark, mergeAttributes } from '@tiptap/core';
import styles from './marks.module.css';

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestionMark: (attributes?: { username?: string; data?: any }) => ReturnType;
      toggleSuggestionMark: (attributes?: { username?: string; data?: any }) => ReturnType;
      unsetSuggestionMark: () => ReturnType;
    };
  }
}

const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: 'suggestionMarkBase',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      username: {
        default: 'AI Assistant',
        parseHTML: (element) => element.getAttribute('data-username'),
        renderHTML: (attributes) => {
          if (!attributes.username) {
            return {};
          }
          return { 'data-username': attributes.username };
        },
      },
      data: { // For potential future use (e.g., storing diff ID)
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-data'),
         renderHTML: (attributes) => {
          if (!attributes.data) {
            return {};
          }
          return { 'data-suggestion-data': JSON.stringify(attributes.data) };
        },
      }
    };
  },

  // Commands are defined here but usually overridden or used via specific marks
  addCommands() {
    return {
      setSuggestionMark: (attributes) => ({ commands }) => {
        return commands.setMark(this.name, attributes);
      },
      toggleSuggestionMark: (attributes) => ({ commands }) => {
        return commands.toggleMark(this.name, attributes);
      },
      unsetSuggestionMark: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});


// --- Suggestion Insert Mark ---
export const SuggestionInsert = SuggestionMark.extend({
  name: 'suggestionInsert',

  parseHTML() {
    return [{ tag: `span[data-suggestion-type="insert"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-suggestion-type': 'insert',
        class: styles.suggestionInsert,
      }),
      0, // Indicates where the content should go
    ];
  },
});

// --- Suggestion Delete Mark ---
export const SuggestionDelete = SuggestionMark.extend({
  name: 'suggestionDelete',

   parseHTML() {
    return [{ tag: `span[data-suggestion-type="delete"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
       mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-suggestion-type': 'delete',
        class: styles.suggestionDelete,
      }),
      0,
    ];
  },
}); 