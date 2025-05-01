import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface HandsontableOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface HandsontableCommands<ReturnType> {
  setHandsontable: () => ReturnType;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    handsontable: {
      setHandsontable: () => ReturnType;
    };
  }
}

export const Handsontable = Node.create<HandsontableOptions>({
  name: 'handsontable',
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
      data: {
        default: [
          ['', '', ''],
          ['', '', ''],
          ['', '', '']
        ],
      },
      class: {
        default: 'handsontable-container',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[class="handsontable-container"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes];
  },

  addCommands() {
    return {
      setHandsontable:
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
      'Mod-Alt-h': () => this.editor.commands.setHandsontable(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
