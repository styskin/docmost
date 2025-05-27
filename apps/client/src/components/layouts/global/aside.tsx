import { ActionIcon, Box, Group, ScrollArea, Text, Textarea, Button, Stack, Tooltip } from "@mantine/core";
import CommentList from "@/features/comment/components/comment-list.tsx";
import { useAtom } from "jotai";
import { effectiveAsideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { ReactNode, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { AIChat } from "@/features/ai/components/ai-chat.tsx";
import { IconX, IconSend, IconEraser, IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { DocumentType } from "@/features/page/types/page.types.ts";

export default function Aside() {
  const [{ tab, isAsideOpen }] = useAtom(effectiveAsideStateAtom);
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const isMobile = useMediaQuery("(max-width: 48em)");
  const { closeAside } = useToggleAside();
  
  // AI Chat input state - managed at aside level
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiChatRef = useRef<{ handleSubmit: (input: string) => Promise<void>; resetChat: () => void } | null>(null);
  
  // Get current context for AI
  const [workspace] = useAtom(workspaceAtom);
  const pathParts = window.location.pathname.split("/");
  const pageSlugIndex = pathParts.indexOf("p") + 1;
  const pageSlug = pageSlugIndex > 0 && pageSlugIndex < pathParts.length ? pathParts[pageSlugIndex] : null;
  const pageId = pageSlug ? extractPageSlugId(pageSlug) : null;
  const { data: currentPage } = usePageQuery({ pageId });

  let title: string;
  let component: ReactNode;

  switch (tab) {
    case "comments":
      component = <CommentList />;
      title = "Comments";
      break;
    case "toc":
      component = <TableOfContents editor={pageEditor} />;
      title = "Table of contents";
      break;
    case "ai":
      component = <AIChat showInput={false} ref={aiChatRef} onLoadingChange={setIsAiLoading} />;
      title = "Chat with AI";
      break;
    default:
      component = null;
      title = null;
  }

  if (!component) {
    return null;
  }

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userInput = aiInput.trim();
    if (!userInput || isAiLoading || !aiChatRef.current) return;

    setAiInput("");
    
    try {
      await aiChatRef.current.handleSubmit(userInput);
    } catch (error) {
      console.error("Error submitting AI message:", error);
    }
  };

  const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleAiSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleQuickAction = (text: string) => {
    setAiInput(text);
    setTimeout(() => {
      const form = document.querySelector("form");
      if (form) {
        const event = new Event("submit", { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
    }, 0);
  };

  // Special handling for AI chat to allow sticky input at aside level
  if (tab === "ai") {
    return (
      <Box 
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Group justify="space-between" p="md" pb="sm" style={{ flexShrink: 0 }}>
          <Text fw={500}>
            {t(title)}
          </Text>
          {isMobile && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={closeAside}
              aria-label={t("Close")}
            >
              <IconX size={16} />
            </ActionIcon>
          )}
        </Group>

        {/* AI Chat content area - takes remaining space minus input area */}
        <Box style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
          {component}
        </Box>

        {/* Input area - truly positioned at aside bottom */}
        <Box
          p="md"
          style={{
            borderTop: "1px solid var(--mantine-color-gray-2)",
            backgroundColor: "var(--mantine-color-body)",
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <Group mb="xs" gap="xs" justify="flex-start">
            {currentPage?.type &&
              [DocumentType.LLM_INSTRUCTION, DocumentType.LLM_SCHEDULED_TASK].includes(currentPage.type) && (
                <Button
                  variant="outline"
                  color="gray"
                  size="xs"
                  radius="xl"
                  onClick={() => handleQuickAction("Execute instructions from this document")}
                >
                  Execute instructions from this document
                </Button>
              )}
            <Button
              variant="outline"
              color="gray"
              size="xs"
              radius="xl"
              onClick={() => handleQuickAction("Summarize this document in 3 sentences")}
            >
              Summarize this document in 3 sentences
            </Button>
          </Group>
          <form onSubmit={handleAiSubmit} style={{ display: "flex", gap: "8px", width: "100%" }}>
            <Textarea
              placeholder="Ask AI anything... (Press Enter to send, Cmd/Ctrl+Enter for new line)"
              value={aiInput}
              onChange={(e) => setAiInput(e.currentTarget.value)}
              onKeyDown={handleAiKeyDown}
              disabled={isAiLoading}
              style={{ flex: 1, width: "100%" }}
              autosize
              minRows={2}
              maxRows={4}
            />
            <Stack gap="xs" style={{ justifyContent: "center" }}>
              <Tooltip label="Clear chat history">
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => aiChatRef.current?.resetChat()}
                  color="gray"
                  px="xs"
                  disabled={isAiLoading}
                >
                  <IconEraser size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Send message">
                <Button
                  type="submit"
                  variant="light"
                  disabled={isAiLoading || !aiInput.trim()}
                  size="xs"
                  px="xs"
                >
                  <IconSend size={16} />
                </Button>
              </Tooltip>
            </Stack>
          </form>
        </Box>
      </Box>
    );
  }

  // Default handling for other components
  return (
    <Box 
      p="md"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" mb="md">
        <Text fw={500}>
          {t(title)}
        </Text>
        {isMobile && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={closeAside}
            aria-label={t("Close")}
          >
            <IconX size={16} />
          </ActionIcon>
        )}
      </Group>

      <ScrollArea
        style={{
          height: "100%",
          flex: 1,
        }}
        scrollbarSize={5}
        type="scroll"
      >
        <div style={{ paddingBottom: isMobile ? "80px" : "20px" }}>
          {component}
        </div>
      </ScrollArea>
    </Box>
  );
}
