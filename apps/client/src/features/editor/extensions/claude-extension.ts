import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ClaudeView from '../components/claude/claude-view';

export interface ClaudeOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    claude: {
      setClaudeAgent: () => ReturnType;
    };
  }
}

export const Claude = Node.create<ClaudeOptions>({
  name: 'claude',
  group: 'block',
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="claude"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'claude', ...HTMLAttributes }, 0];
  },

  addCommands() {
    return {
      setClaudeAgent:
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
      'Mod-Alt-k': () => this.editor.commands.setClaudeAgent(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ClaudeView);
  },
}); 