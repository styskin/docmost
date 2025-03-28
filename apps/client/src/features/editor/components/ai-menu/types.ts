import { Range } from "@tiptap/core";
import { useEditor } from "@tiptap/react";

export type CommandProps = {
  editor: ReturnType<typeof useEditor>;
  range: Range;
};

export type AIMenuItemType = {
  id: string;
  title: string;
  description: string;
  command: (props: CommandProps) => Promise<void>;
}; 