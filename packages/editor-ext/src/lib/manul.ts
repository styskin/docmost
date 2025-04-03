import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface ManulOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface ManulCommands<ReturnType> {
  setManulAgent: () => ReturnType;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    manul: {
      setManulAgent: () => ReturnType;
    };
  }
}

export const Manul = Node.create<ManulOptions>({
  name: 'manul',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  inline: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      class: {
        default: 'manul-container',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[class="manul-container"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setManulAgent:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-k': () => this.editor.commands.setManulAgent(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
}); 