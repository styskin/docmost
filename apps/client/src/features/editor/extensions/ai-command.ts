import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { getAIItems } from "../components/ai-menu/ai-items";
import renderAIItems from "../components/ai-menu/render-ai-items";

export const aiMenuPluginKey = new PluginKey("ai-command");

const Command = Extension.create({
  name: "ai-command",

  addOptions() {
    return {
      suggestion: {
        char: ' ',
        startOfLine: true,
        insert: () => null,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .run();
          props.command({ editor, range, props });
        },
        allow: ({ state, range }) => {
          const $pos = state.doc.resolve(range.from);
          return $pos.parentOffset === 0;
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: aiMenuPluginKey,
        ...this.options.suggestion,
        editor: this.editor,
      }),
    ];
  },
});

const AICommand = Command.configure({
  suggestion: {
    items: getAIItems,
    render: renderAIItems,
  },
});

export default AICommand; 