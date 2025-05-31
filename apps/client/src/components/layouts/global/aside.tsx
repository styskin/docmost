import {
  ActionIcon,
  Box,
  Group,
  ScrollArea,
  Text,
  Textarea,
  Button,
  Stack,
  Tooltip,
} from "@mantine/core";
import CommentList from "@/features/comment/components/comment-list.tsx";
import { useAtom } from "jotai";
import { effectiveAsideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { ReactNode, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { AIChat } from "@/features/ai/components/ai-chat.tsx";
import {
  IconX,
  IconSend,
  IconEraser,
  IconMicrophone,
  IconMicrophoneOff,
} from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { DocumentType } from "@/features/page/types/page.types.ts";
import { useASR } from "../../../features/ai/utils/asr";
import { ttsPlayer } from "@/features/ai/utils/tts-player";

export default function Aside() {
  const [{ tab, isAsideOpen }] = useAtom(effectiveAsideStateAtom);
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const isMobile = useMediaQuery("(max-width: 48em)");
  const { closeAside } = useToggleAside();

  // AI Chat input state - managed at aside level
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiChatRef = useRef<{
    handleSubmit: (input: string) => Promise<void>;
    resetChat: () => void;
  } | null>(null);

  // Track TTS completion to trigger re-evaluation of TTS state
  const [ttsCompletionCounter, setTtsCompletionCounter] = useState(0);

  // Track whether we should resume listening after TTS completes
  const [shouldResumeListening, setShouldResumeListening] = useState(false);
  const shouldResumeListeningRef = useRef(false);

  // Update ref when state changes
  useEffect(() => {
    shouldResumeListeningRef.current = shouldResumeListening;
  }, [shouldResumeListening]);

  // Speech recognition using the new ASR utility
  const asr = useASR({
    onTranscriptChange: setAiInput,
    onFinalTranscript: (transcript) => {
      const timestamp = new Date().toISOString().substr(11, 12);
      console.log(
        `[ASIDE ${timestamp}] Final transcript received, submitting form`,
      );

      // Set flag to resume listening after TTS
      setShouldResumeListening(true);

      const form = document.querySelector("form");
      if (form) {
        const formEvent = new Event("submit", {
          cancelable: true,
          bubbles: true,
        });
        form.dispatchEvent(formEvent);
      }
    },
  });

  // Log state changes for debugging
  useEffect(() => {
    const timestamp = new Date().toISOString().substr(11, 12);
    console.log(
      `[ASIDE ${timestamp}] State change - listening: ${asr.isListening}, loading: ${isAiLoading}, ttsCompletion: ${ttsCompletionCounter}, shouldResume: ${shouldResumeListening}`,
    );
  }, [
    asr.isListening,
    isAiLoading,
    ttsCompletionCounter,
    shouldResumeListening,
  ]);

  // Setup TTS integration with speech recognition - run once on mount
  useEffect(() => {
    // Set up TTS playback complete callback to restart speech recognition
    ttsPlayer.setOnPlaybackComplete(() => {
      const timestamp = new Date().toISOString().substr(11, 12);
      console.log(`[ASIDE ${timestamp}] TTS playback complete`);

      // Trigger re-evaluation of TTS state
      setTtsCompletionCounter((prev) => prev + 1);

      // Check if this was the final audio chunk and we should resume listening
      setTimeout(() => {
        const hasPendingAudio = ttsPlayer.hasPendingAudio();
        const shouldResume = shouldResumeListeningRef.current; // Use ref for current value
        console.log(
          `[ASIDE ${timestamp}] Checking if should restart ASR - pendingAudio: ${hasPendingAudio}, shouldResume: ${shouldResume}`,
        );

        if (!hasPendingAudio && shouldResume) {
          console.log(
            `[ASIDE ${timestamp}] All TTS complete, restarting speech recognition`,
          );
          setShouldResumeListening(false);
          asr.startListening();
        }
      }, 100); // Small delay to let TTS state update
    });

    // Cleanup function - only runs on actual component unmount
    return () => {
      const timestamp = new Date().toISOString().substr(11, 12);
      console.log(
        `[ASIDE ${timestamp}] Aside component unmounting - disabling TTS`,
      );
      ttsPlayer.disable();
    };
  }, []); // Empty dependency array - only run once on mount/unmount

  // Enable/disable TTS based on listening state OR loading state OR pending audio
  // Keep TTS enabled until all audio finishes playing
  useEffect(() => {
    const shouldEnableTTS =
      asr.isListening || isAiLoading || ttsPlayer.hasPendingAudio();
    const timestamp = new Date().toISOString().substr(11, 12);

    if (shouldEnableTTS) {
      console.log(
        `[ASIDE ${timestamp}] Enabling TTS (listening: ${asr.isListening}, loading: ${isAiLoading}, pendingAudio: ${ttsPlayer.hasPendingAudio()})`,
      );
      ttsPlayer.enable();
    } else {
      console.log(
        `[ASIDE ${timestamp}] Disabling TTS (listening: ${asr.isListening}, loading: ${isAiLoading}, pendingAudio: ${ttsPlayer.hasPendingAudio()})`,
      );
      ttsPlayer.disable();
    }
  }, [asr.isListening, isAiLoading, ttsCompletionCounter]);

  // Get current context for AI
  const [workspace] = useAtom(workspaceAtom);
  const pathParts = window.location.pathname.split("/");
  const pageSlugIndex = pathParts.indexOf("p") + 1;
  const pageSlug =
    pageSlugIndex > 0 && pageSlugIndex < pathParts.length
      ? pathParts[pageSlugIndex]
      : null;
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
      component = (
        <AIChat
          showInput={false}
          ref={aiChatRef}
          onLoadingChange={setIsAiLoading}
        />
      );
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

    const timestamp = new Date().toISOString().substr(11, 12);
    const userInput = aiInput.trim();
    if (!userInput || isAiLoading || !aiChatRef.current) {
      console.log(
        `[ASIDE ${timestamp}] Submit blocked - input: "${userInput}", loading: ${isAiLoading}, chatRef: ${!!aiChatRef.current}`,
      );
      return;
    }

    console.log(
      `[ASIDE ${timestamp}] Starting AI submission - input: "${userInput}"`,
    );
    setAiInput("");

    // Stop listening when submitting
    if (asr.isListening) {
      console.log(`[ASIDE ${timestamp}] Stopping listening before submission`);
      asr.stopListening();
    }

    try {
      await aiChatRef.current.handleSubmit(userInput);
      console.log(`[ASIDE ${timestamp}] AI submission completed`);
    } catch (error) {
      console.error(`[ASIDE ${timestamp}] Error submitting AI message:`, error);
    }
  };

  const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
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
        <Group
          justify="space-between"
          p={isMobile ? "lg" : "md"}
          pb={isMobile ? "md" : "sm"}
          style={{
            flexShrink: 0,
            borderBottom: isMobile
              ? "1px solid var(--mantine-color-gray-3)"
              : "none",
          }}
        >
          <Text fw={500} size={isMobile ? "lg" : "md"}>
            {t(title)}
          </Text>
          {isMobile && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={closeAside}
              aria-label={t("Close")}
              size="lg"
            >
              <IconX size={20} />
            </ActionIcon>
          )}
        </Group>

        {/* AI Chat content area - takes remaining space minus input area */}
        <Box
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
            paddingBottom: isMobile ? "180px" : 0, // Add padding to prevent content from being hidden behind input
          }}
        >
          {component}
        </Box>

        {/* Input area - truly positioned at aside bottom */}
        <Box
          p={isMobile ? "lg" : "md"}
          style={{
            borderTop: "1px solid var(--mantine-color-gray-2)",
            backgroundColor: "var(--mantine-color-body)",
            flexShrink: 0,
            zIndex: 100,
            ...(isMobile
              ? {
                  position: "fixed",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  paddingBottom: "env(safe-area-inset-bottom, 16px)", // Account for Safari omnibox
                  maxHeight: "50vh", // Prevent input from taking too much space
                }
              : {}),
          }}
        >
          <Group
            mb={isMobile ? "md" : "xs"}
            gap={isMobile ? "sm" : "xs"}
            justify="flex-start"
          >
            {currentPage?.type &&
              [
                DocumentType.LLM_INSTRUCTION,
                DocumentType.LLM_SCHEDULED_TASK,
              ].includes(currentPage.type) && (
                <Button
                  variant="outline"
                  color="gray"
                  size={isMobile ? "sm" : "xs"}
                  radius="xl"
                  onClick={() =>
                    handleQuickAction("Execute instructions from this document")
                  }
                  style={{ fontSize: isMobile ? "14px" : undefined }}
                >
                  Execute instructions from this document
                </Button>
              )}
            <Button
              variant="outline"
              color="gray"
              size={isMobile ? "sm" : "xs"}
              radius="xl"
              onClick={() =>
                handleQuickAction("Summarize this document in 3 sentences")
              }
              style={{ fontSize: isMobile ? "14px" : undefined }}
            >
              Summarize this document in 3 sentences
            </Button>
          </Group>
          <form
            onSubmit={handleAiSubmit}
            style={{ display: "flex", gap: "8px", width: "100%" }}
          >
            <Textarea
              placeholder="Ask AI anything... (Press Enter to send, Cmd/Ctrl+Enter for new line)"
              value={aiInput}
              onChange={(e) => setAiInput(e.currentTarget.value)}
              onKeyDown={handleAiKeyDown}
              disabled={isAiLoading}
              style={{
                flex: 1,
                width: "100%",
                fontSize: isMobile ? "16px" : undefined,
              }}
              autosize
              minRows={isMobile ? 4 : 4}
              maxRows={isMobile ? 6 : 5}
            />
            <Stack
              gap={isMobile ? "sm" : "xs"}
              style={{ justifyContent: "center" }}
            >
              <Tooltip label="Clear chat history">
                <Button
                  variant="light"
                  size={isMobile ? "sm" : "xs"}
                  onClick={() => aiChatRef.current?.resetChat()}
                  color="gray"
                  px={isMobile ? "sm" : "xs"}
                  disabled={isAiLoading}
                >
                  <IconEraser size={isMobile ? 18 : 16} />
                </Button>
              </Tooltip>
              {asr.isSupported && (
                <Tooltip label="Toggle voice input">
                  <Button
                    type="button"
                    variant="light"
                    color={asr.isListening ? "red" : "blue"}
                    onClick={() => {
                      const timestamp = new Date().toISOString().substr(11, 12);
                      console.log(
                        `[ASIDE ${timestamp}] Manual microphone toggle - currently listening: ${asr.isListening}`,
                      );

                      if (asr.isListening) {
                        // User is manually stopping listening - clear resume flag
                        setShouldResumeListening(false);
                      }

                      asr.toggleListening();
                    }}
                    disabled={isAiLoading}
                    size={isMobile ? "sm" : "xs"}
                    px={isMobile ? "sm" : "xs"}
                  >
                    {asr.isListening ? (
                      <IconMicrophoneOff size={isMobile ? 18 : 16} />
                    ) : (
                      <IconMicrophone size={isMobile ? 18 : 16} />
                    )}
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="Send message">
                <Button
                  type="submit"
                  variant="light"
                  disabled={isAiLoading || !aiInput.trim()}
                  size={isMobile ? "sm" : "xs"}
                  px={isMobile ? "sm" : "xs"}
                >
                  <IconSend size={isMobile ? 18 : 16} />
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
      p={isMobile ? "lg" : "md"}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group
        justify="space-between"
        mb={isMobile ? "lg" : "md"}
        style={{
          borderBottom: isMobile
            ? "1px solid var(--mantine-color-gray-3)"
            : "none",
          paddingBottom: isMobile ? "md" : 0,
        }}
      >
        <Text fw={500} size={isMobile ? "lg" : "md"}>
          {t(title)}
        </Text>
        {isMobile && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={closeAside}
            aria-label={t("Close")}
            size="lg"
          >
            <IconX size={20} />
          </ActionIcon>
        )}
      </Group>

      <ScrollArea
        style={{
          height: "100%",
          flex: 1,
        }}
        scrollbarSize={isMobile ? 8 : 5}
        type="scroll"
      >
        <div style={{ paddingBottom: isMobile ? "40px" : "20px" }}>
          {component}
        </div>
      </ScrollArea>
    </Box>
  );
}
