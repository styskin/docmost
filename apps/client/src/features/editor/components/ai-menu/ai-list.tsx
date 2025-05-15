import {
  Paper,
  Text,
  UnstyledButton,
  Loader,
  Textarea,
  Box,
  Divider,
} from "@mantine/core";
import { AIMenuItemType } from "./types";
import classes from "./ai-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconPencil,
  IconFileDescription,
  IconListCheck,
  IconChartBar,
  IconTable,
} from "@tabler/icons-react";
import { markdownToTiptap } from "./markdown-to-tiptap";

interface AIListProps {
  items: AIMenuItemType[];
  isLoading: boolean;
  command: any;
  editor: any;
  range: any;
  query: string;
  autoFocus?: boolean;
}

const groupItemsByCategory = (items: AIMenuItemType[]) => {
  const suggestedItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes("continue") ||
      item.title.toLowerCase().includes("suggest"),
  );

  const writeItems = items.filter((item) => !suggestedItems.includes(item));

  return {
    suggested: suggestedItems,
    write: writeItems,
  };
};

// Get icon for menu item based on title
const getItemIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes("continue") ||
    lowerTitle.includes("write anything")
  ) {
    return <IconPencil size={16} stroke={1.5} />;
  } else if (lowerTitle.includes("summary")) {
    return <IconFileDescription size={16} stroke={1.5} />;
  } else if (lowerTitle.includes("action") || lowerTitle.includes("list")) {
    return <IconListCheck size={16} stroke={1.5} />;
  } else if (lowerTitle.includes("flowchart") || lowerTitle.includes("chart")) {
    return <IconChartBar size={16} stroke={1.5} />;
  } else if (lowerTitle.includes("table")) {
    return <IconTable size={16} stroke={1.5} />;
  }

  return <IconPencil size={16} stroke={1.5} />;
};

export default function AIList({
  items,
  isLoading,
  command,
  editor,
}: AIListProps) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const groupedItems = groupItemsByCategory(items);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (editor && editor.view) {
      const { state } = editor;
      const { selection } = state;
      const { from } = selection;

      const coords = editor.view.coordsAtPos(from);

      if (coords) {
        setCursorPosition({
          top: coords.top,
          left: coords.left,
        });
      }
    }
  }, [editor]);

  useEffect(() => {
    if (textAreaRef.current) {
      setTimeout(() => {
        textAreaRef.current?.focus();
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
    setStreamingContent("");

    try {
      
      const response = await fetch("/api/manul/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Hint: Remember to focus solely on providing the inline addition. Do not call any tools, do not provide any additional information or reasoning, do not engage in any dialogue or ask for additional information from the user.
              Current document: 
              - ${editor.state.doc.textContent}`,
            },
            {
              role: "user",
              content: preview,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let partialChunk = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partialChunk += chunk;

        while (partialChunk.includes("\n\n")) {
          const eventEnd = partialChunk.indexOf("\n\n");
          const eventData = partialChunk.substring(0, eventEnd);
          partialChunk = partialChunk.substring(eventEnd + 2);

          if (eventData.startsWith("data: ")) {
            try {
              const jsonData = JSON.parse(eventData.slice(6));
              // FIXME: Think about formating support in streaming mode
              for (const item of jsonData.content) {
                if (item.type === "text" && item.text !== undefined) {
                  editor.chain().focus().insertContentAt(getPos(), item.text).run();
                }
                // setStreamingContent(fullResponse);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

//      const tiptapJson = markdownToTiptap(fullResponse);
//    editor.chain().focus().insertContentAt(getPos(), tiptapJson).run();

  
      setPreview("");
    } catch (error) {
      console.error("Error querying Manul:", error);
    } finally {
      setIsSubmitting(false);
      setStreamingContent("");
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
        overflow: "hidden",
        width: "400px",
        marginTop: "-35px",
        position: "relative",
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
          caretColor: "var(--mantine-color-blue-6)",
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
                  onClick={() =>
                    selectItem(items.findIndex((i) => i.id === item.id))
                  }
                  p="xs"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    cursor: "pointer",
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
                  onClick={() =>
                    selectItem(items.findIndex((i) => i.id === item.id))
                  }
                  p="xs"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    cursor: "pointer",
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
        <Box p="md" style={{ display: "flex", justifyContent: "center" }}>
          <Loader size="sm" />
        </Box>
      )}

      {/* Display streaming content */}
      {streamingContent && (
        <Box p="xs" style={{ maxHeight: "200px", overflowY: "auto" }}>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {streamingContent}
          </Text>
        </Box>
      )}
    </Paper>
  ) : null;
}
