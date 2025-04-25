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
  Box,
  Divider,
  Group,
} from "@mantine/core";
import { AIMenuItemType } from "./types";
import clsx from "clsx";
import classes from "./ai-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { 
  IconPencil, 
  IconFileDescription, 
  IconListCheck, 
  IconChartBar, 
  IconTable 
} from "@tabler/icons-react";

interface AIListProps {
  items: AIMenuItemType[];
  isLoading: boolean;
  command: any;
  editor: any;
  range: any;
  query: string;
  autoFocus?: boolean;
}

// Group items by category
const groupItemsByCategory = (items: AIMenuItemType[]) => {
  const suggestedItems = items.filter(item => 
    item.title.toLowerCase().includes('continue') || 
    item.title.toLowerCase().includes('suggest')
  );
  
  const writeItems = items.filter(item => 
    !suggestedItems.includes(item)
  );
  
  return {
    suggested: suggestedItems,
    write: writeItems
  };
};

// Get icon for menu item based on title
const getItemIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('continue') || lowerTitle.includes('write anything')) {
    return <IconPencil size={16} stroke={1.5} />;
  } else if (lowerTitle.includes('summary')) {
    return <IconFileDescription size={16} stroke={1.5} />;
  } else if (lowerTitle.includes('action') || lowerTitle.includes('list')) {
    return <IconListCheck size={16} stroke={1.5} />;
  } else if (lowerTitle.includes('flowchart') || lowerTitle.includes('chart')) {
    return <IconChartBar size={16} stroke={1.5} />;
  } else if (lowerTitle.includes('table')) {
    return <IconTable size={16} stroke={1.5} />;
  }
  
  return <IconPencil size={16} stroke={1.5} />;
};

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
  const groupedItems = groupItemsByCategory(items);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });

  // Get cursor position from editor
  useEffect(() => {
    if (editor && editor.view) {
      const { state } = editor;
      const { selection } = state;
      const { from } = selection;
      
      // Get coordinates of cursor position
      const coords = editor.view.coordsAtPos(from);
      
      if (coords) {
        setCursorPosition({
          top: coords.top,
          left: coords.left
        });
      }
    }
  }, [editor]);

  // Focus the textarea when component mounts
  useEffect(() => {
    if (textAreaRef.current) {
      setTimeout(() => {
        textAreaRef.current?.focus();
        // Place cursor at the end of any existing text
        if (textAreaRef.current.value) {
          const length = textAreaRef.current.value.length;
          textAreaRef.current.setSelectionRange(length, length);
        }
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
          context: editor.state.doc.textContent,
        }),
      });

      const data = await response.json();
      editor
        .chain()
        .focus()
        .insertContentAt(getPos(), data.data.response)
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
        setPreview(item.prompt.trim());
        textAreaRef.current?.focus();
      }
    },
    [command, items],
  );
  return items.length > 0 || isLoading ? (
    <Paper 
      id="ai-command" 
      shadow="sm" 
      withBorder 
      style={{ 
        overflow: 'hidden',
        width: "400px",
        // Fine-tune the position to be exactly at the cursor
        marginTop: "-35px",
        position: 'relative'
      }}
    >
      <Textarea
        minRows={1}
        autosize
        ref={textAreaRef}
        draggable={false}
        classNames={{ input: classes.textInput }}
        value={preview}
        placeholder={"Ask AI anything"}
        style={{ 
          width: "100%",
          caretColor: 'var(--mantine-color-blue-6)'
        }}
        autoFocus
        onFocus={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            return editor.commands.focus(getPos());
          }

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            editor.commands.focus(getPos());
            handleSubmit();
            return editor.commands.focus(getPos());
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
            editor.commands.focus(getPos());
          }
        }}
        onChange={(e) => {
          setPreview(e.target.value);
        }}
      />
      
      {/* Menu items styled like AiMenu.png */}
      {!isLoading && items.length > 0 && (
        <>
          {/* Suggested Section */}
          {groupedItems.suggested.length > 0 && (
            <Box>
              <Box p="xs" bg="var(--mantine-color-gray-0)">
                <Text size="xs" c="dimmed" fw={500} pb={4}>
                  Suggested
                </Text>
              </Box>
              {groupedItems.suggested.map((item, index) => (
                <UnstyledButton
                  key={item.id}
                  className={classes.menuItem}
                  onClick={() => selectItem(items.findIndex(i => i.id === item.id))}
                  p="xs"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <Box mr={8} style={{ opacity: 0.7 }}>
                    {getItemIcon(item.title)}
                  </Box>
                  <Text size="sm">{item.title}</Text>
                </UnstyledButton>
              ))}
            </Box>
          )}
          
          {/* Write Section */}
          {groupedItems.write.length > 0 && (
            <Box>
              {groupedItems.suggested.length > 0 && <Divider my={0} />}
              <Box p="xs" bg="var(--mantine-color-gray-0)">
                <Text size="xs" c="dimmed" fw={500} pb={4}>
                  Write
                </Text>
              </Box>
              {groupedItems.write.map((item, index) => (
                <UnstyledButton
                  key={item.id}
                  className={classes.menuItem}
                  onClick={() => selectItem(items.findIndex(i => i.id === item.id))}
                  p="xs"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <Box mr={8} style={{ opacity: 0.7 }}>
                    {getItemIcon(item.title)}
                  </Box>
                  <Text size="sm">{item.title}</Text>
                </UnstyledButton>
              ))}
            </Box>
          )}
        </>
      )}
      
      {isLoading && (
        <Box p="md" style={{ display: 'flex', justifyContent: 'center' }}>
          <Loader size="sm" />
        </Box>
      )}
    </Paper>
  ) : null;
}
