import {
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
  Loader,
  TextInput,
  Popover,
  Textarea,
} from "@mantine/core";
import { AIMenuItemType } from "./types";
import clsx from "clsx";
import classes from "./ai-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

interface AIListProps {
  items: AIMenuItemType[];
  isLoading: boolean;
  command: any;
  editor: any;
  range: any;
  query: string;
  autoFocus?: boolean;
}

export default function AIList({
  items,
  isLoading,
  command,
  editor,
  range,
  query,
  autoFocus,
}: AIListProps) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (textAreaRef.current) {
      setTimeout(() => {
        textAreaRef.current?.focus();
      }, 0);
    }
  }, []);

  const getPos = () => {
    return editor.state.selection.from;
  };

  const handleSubmit = async () => {
    if (!preview.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/manul/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          query: preview,
          context: editor.state.doc.textContent 
        }),
      });

      const data = await response.json();      
      // Insert Claude's response into the editor after the current position
      editor
        .chain()
        .focus()
        .insertContentAt(getPos(), [
          { 
            type: 'paragraph', 
            content: [{ type: 'text', text: data.data.response }]
          },
        ])
        .run();

      setPreview("");
    } catch (error) {
      console.error("Error querying Manul:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [command, items]
  );
  return items.length > 0 || isLoading ? (
    <Paper 
      id="ai-command" 
      p="0" 
      shadow="md" 
      withBorder
    >
      <Textarea
        minRows={1}
        autosize
        ref={textAreaRef}
        draggable={false}
        classNames={{ input: classes.textInput }}
        value={preview}
        placeholder={"Ask AI anything"}
        style={{ marginTop: '-40px', width: '400px' }}
        onFocus={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            return editor.commands.focus(getPos() + 1);
          }

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            editor.commands.focus(getPos() + 1);
            handleSubmit();
            return editor.commands.focus(getPos() + 1);
          }

          if (!textAreaRef.current) return;

          const { selectionStart, selectionEnd } = textAreaRef.current;

          if (
            e.key === "ArrowLeft" &&
            selectionStart === selectionEnd &&
            selectionStart === 0
          ) {
            editor.commands.focus(getPos());
          }

          if (
            e.key === "ArrowRight" &&
            selectionStart === selectionEnd &&
            selectionStart === textAreaRef.current.value.length
          ) {
            editor.commands.focus(getPos() + 1);
          }
        }}
        onChange={(e) => {
          setPreview(e.target.value);
        }}
      />

    </Paper>
  ) : null;
}
