import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Group,
  Collapse,
  Loader,
} from "@mantine/core";
import {
  IconSend,
  IconTools,
  IconChevronDown,
  IconChevronRight,
  IconMicrophone,
  IconMicrophoneOff,
} from "@tabler/icons-react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { ttsPlayer } from "../utils/tts-player";

// Add Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionError) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Message type definition
interface Message {
  id: string;
  role: "user" | "assistant";
  segments: MessageSegment[];
}

// Message segment types
type MessageSegment = TextSegment | ToolCallSegment;

interface TextSegment {
  type: "text";
  content: string;
}

interface ToolCallSegment {
  type: "tool_call";
  id: string;
  name: string;
  data: string;
  result?: string;
  isOpen: boolean;
}

export function AIChat() {
  // Get current context
  const [workspace] = useAtom(workspaceAtom);
  const pathParts = window.location.pathname.split("/");
  const pageSlugIndex = pathParts.indexOf("p") + 1;
  const pageSlug =
    pageSlugIndex > 0 && pageSlugIndex < pathParts.length
      ? pathParts[pageSlugIndex]
      : null;
  const pageId = pageSlug ? extractPageSlugId(pageSlug) : null;
  const { data: currentPage } = usePageQuery({ pageId });

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-message",
      role: "assistant",
      segments: [{ type: "text", content: "How can I help you?" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isRestartingRecognition, setIsRestartingRecognition] = useState(false);

  const toggleToolCall = (
    messageId: string,
    toolId: string,
    event?: React.MouseEvent,
  ) => {
    // Prevent auto-scroll when manually toggling tool calls
    if (event) {
      event.stopPropagation();
      setShouldAutoScroll(false);
    }

    if (currentAssistantMessage && currentAssistantMessage.id === messageId) {
      setCurrentAssistantMessage((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          segments: prev.segments.map((segment) => {
            if (segment.type === "tool_call" && segment.id === toolId) {
              return { ...segment, isOpen: !segment.isOpen };
            }
            return segment;
          }),
        };
      });
      return;
    }

    setMessages((prevMessages) =>
      prevMessages.map((message) => {
        if (message.id === messageId) {
          return {
            ...message,
            segments: message.segments.map((segment) => {
              if (segment.type === "tool_call" && segment.id === toolId) {
                return { ...segment, isOpen: !segment.isOpen };
              }
              return segment;
            }),
          };
        }
        return message;
      }),
    );
  };

  // Auto-scroll to the bottom when new messages arrive or streaming content updates
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentAssistantMessage, shouldAutoScroll]);

  // Re-enable auto-scrolling when new messages are added
  useEffect(() => {
    setShouldAutoScroll(true);
  }, [messages.length]);

  // Re-enable auto-scrolling when user is typing a new message
  useEffect(() => {
    if (input.trim().length > 0) {
      setShouldAutoScroll(true);
      ttsPlayer.stop(); // Stop TTS when user starts typing
    }
  }, [input]);

  useEffect(() => {
    // Initialize speech recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep continuous for longer phrases
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        // Combine all results for the current utterance
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        
        setInput(transcript);

        // Check if the *last* result is final
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal && transcript.trim()) {
          console.log('Final transcript received, submitting form');
          // Submit the form
          const formEvent = new Event('submit', { cancelable: true, bubbles: true });
          const form = document.querySelector('form'); 
          if (form) {
            form.dispatchEvent(formEvent);
            // Stop recognition to clear its internal state
            recognitionRef.current?.stop(); 
          }
          // Note: Input clearing is handled by handleSubmit now
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionError) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.log('Attempting to restart speech recognition after error:', event.error);
          // Attempt to restart listening if it was not manually stopped
          if (isListening && !isRestartingRecognition) {
            safelyRestartRecognition();
          }
        } else {
          setIsListening(false); // Turn off listening state on other errors
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        // Only restart if we are *still* supposed to be listening
        // This handles the case where stop() was called manually or after submission
        if (isListening && !isRestartingRecognition) {
          console.log('Restarting speech recognition from onend');
          safelyRestartRecognition();
        }
      };
    }

    // Set TTS playback complete callback
    ttsPlayer.setOnPlaybackComplete(() => {
      console.log('TTS playback complete');
      
      // Use a slight delay before restarting speech recognition
      // This ensures the audio context has fully finished
      setTimeout(() => {
        console.log('Attempting to restart speech recognition after TTS');
        
        // Only try to restart if we're not already in the process of restarting
        if (!isRestartingRecognition) {
          safelyRestartRecognition();
        }
      }, 300);
    });

    return () => {
      // Ensure recognition is stopped when the component unmounts
      if (recognitionRef.current) {
        console.log('Stopping speech recognition on component unmount');
        recognitionRef.current.stop();
      }
    };
  }, [isListening, isRestartingRecognition]); // Include isRestartingRecognition in dependencies
  
  const safelyRestartRecognition = () => {
    if (isRestartingRecognition || !recognitionRef.current) return;
    
    setIsRestartingRecognition(true);
    
    try {
      // First stop the recognition
      recognitionRef.current.stop();
      
      // After a delay, try to start it again
      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
            console.log('Speech recognition restarted successfully');
            setIsListening(true);
          }
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setIsListening(false);
        } finally {
          setIsRestartingRecognition(false);
        }
      }, 200);
    } catch (error) {
      console.error('Error stopping speech recognition before restart:', error);
      setIsListening(false);
      setIsRestartingRecognition(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }

    if (isRestartingRecognition) {
      console.log('Cannot toggle while restarting recognition, please wait');
      return;
    }

    if (isListening) {
      console.log('Stopping listening and TTS');
      recognitionRef.current.stop();
      setIsListening(false);
      ttsPlayer.disable(); // Disable TTS when stopping STT
    } else {
      try {
        console.log('Starting listening and enabling TTS');
        recognitionRef.current.start();
        setIsListening(true);
        ttsPlayer.enable(); // Enable TTS when starting STT
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        ttsPlayer.disable(); // Ensure TTS is disabled if start fails
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if STT was active when this request was initiated
    const playResponseTTS = isListening;

    const userInput = input.trim();
    if (!userInput || isLoading) return;

    // Clear input immediately after grabbing the value for submission
    setInput(""); 

    // If the user submitted via STT, stop listening now
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      // ttsPlayer.disable() will be called due to setIsListening(false) triggering the useEffect or toggleListening logic indirectly
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      segments: [{ type: "text", content: userInput }],
    };

    const apiMessages = messages.concat(userMessage).map((m) => {
      const baseMessage = {
        role:
          m.role === "user"
            ? "user"
            : m.role === "assistant"
              ? "assistant"
              : "system",
        content: m.segments
          .filter((s) => s.type === "text")
          .map((s) => (s as TextSegment).content)
          .join(""),
      };

      const toolCallSegments = m.segments.filter(
        (s) => s.type === "tool_call",
      ) as ToolCallSegment[];
      if (m.role === "assistant" && toolCallSegments.length > 0) {
        const toolCalls = toolCallSegments.map((segment) => ({
          id: segment.id,
          type: "function",
          function: {
            name: segment.name,
            arguments: segment.data, // Should be a JSON string
          },
        }));

        return {
          ...baseMessage,
          tool_calls: toolCalls,
        };
      }

      if (
        m.role === "user" &&
        toolCallSegments.length > 0 &&
        toolCallSegments[0].result
      ) {
        const tool = toolCallSegments[0];
        return {
          role: "tool",
          content: tool.result || "",
          tool_call_id: tool.id,
        };
      }

      return baseMessage;
    });

    const systemMessage = {
      role: "system",
      content: `Current context:
      - workspaceId: ${workspace?.id},
      - spaceSlug: ${currentPage?.space?.slug},
      - documentSlug: ${currentPage?.slugId || pageSlug}`,
    };
    const messagesWithSystem = [systemMessage, ...apiMessages];

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setShouldAutoScroll(true);

    const newMessageId = Date.now().toString();
    setCurrentAssistantMessage({
      id: newMessageId,
      role: "assistant",
      segments: [],
    });

    try {
      const response = await fetch("/api/manul/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesWithSystem }),
      });

      if (!response.ok)
        throw new Error(`Failed to get response: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let partialChunk = "";
      let currentToolId: string | null = null;

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
              console.log("STREAM DATA:", jsonData); // Debug the incoming data

              // HANDLE TOOL CALL CHUNKS: {"tool_call_chunks": [{"name": null, "args": "{\"workspace\"", "id": null, "index": 1, "type": "tool_call_chunk"}]}
              if (
                jsonData.tool_call_chunks &&
                Array.isArray(jsonData.tool_call_chunks)
              ) {
                setCurrentAssistantMessage((prev) => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];

                  for (const chunk of jsonData.tool_call_chunks) {
                    // New tool call with ID and name
                    if (chunk.id && chunk.name) {
                      currentToolId = chunk.id;
                      segments.push({
                        type: "tool_call",
                        id: chunk.id,
                        name: chunk.name,
                        data: chunk.args || "",
                        isOpen: false,
                      } as ToolCallSegment);
                    }
                    // Continuation of existing tool call
                    else if (chunk.args !== undefined) {
                      // If we have a current tool ID, try to find that specific tool call
                      if (currentToolId) {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (
                            segments[i].type === "tool_call" &&
                            (segments[i] as ToolCallSegment).id ===
                              currentToolId
                          ) {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data: toolSegment.data + (chunk.args || ""),
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      }
                      // Otherwise find the most recent tool call
                      else {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (segments[i].type === "tool_call") {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data: toolSegment.data + (chunk.args || ""),
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      }
                    }
                  }

                  console.log("UPDATED TOOL CHUNKS:", segments);
                  return { ...prev, segments };
                });
              }

              // HANDLE TEXT: {'content': [{'text': 'I', 'type': 'text', 'index': 0}]}
              else if (jsonData.content && Array.isArray(jsonData.content)) {
                setCurrentAssistantMessage((prev) => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];
                  let textChunkForTTS = "";

                  // Process text content
                  for (const item of jsonData.content) {
                    if (item.type === "text" && item.text !== undefined) {
                      textChunkForTTS += item.text;
                      // If already have a text segment, append to it
                      if (
                        segments.length > 0 &&
                        segments[segments.length - 1].type === "text"
                      ) {
                        const lastSegment = segments[
                          segments.length - 1
                        ] as TextSegment;
                        segments[segments.length - 1] = {
                          ...lastSegment,
                          content: lastSegment.content + item.text,
                        };
                      }
                      // Otherwise create a new text segment
                      else {
                        segments.push({
                          type: "text",
                          content: item.text,
                        });
                      }
                    }

                    // Process tool_use content in the same update
                    if (item.type === "tool_use") {
                      if (item.id && item.name) {
                        currentToolId = item.id;
                        segments.push({
                          type: "tool_call",
                          id: item.id,
                          name: item.name,
                          data: item.partial_json || "",
                          isOpen: false,
                        } as ToolCallSegment);
                      } else if (item.partial_json !== undefined) {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (segments[i].type === "tool_call") {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data:
                                toolSegment.data + (item.partial_json || ""),
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      }
                    }
                  }

                  if (textChunkForTTS) {
                    if (playResponseTTS) {
                      ttsPlayer.addText(textChunkForTTS);
                    }
                  }

                  console.log("UPDATED SEGMENTS:", segments);
                  return { ...prev, segments };
                });
              }

              // HANDLE TOOL RESPONSE: {"content": "[\n  {\n    "id": "0196...",...}]", "tool_call_id": "toolu_..."}
              else if (jsonData.tool_call_id && jsonData.content) {
                setCurrentAssistantMessage((prev) => {
                  if (!prev) return prev;

                  const segments = [...prev.segments];
                  for (let i = 0; i < segments.length; i++) {
                    if (
                      segments[i].type === "tool_call" &&
                      (segments[i] as ToolCallSegment).id ===
                        jsonData.tool_call_id
                    ) {
                      segments[i] = {
                        ...(segments[i] as ToolCallSegment),
                        result: jsonData.content,
                      } as ToolCallSegment;
                      break;
                    }
                  }

                  console.log("UPDATED TOOL RESPONSE:", segments);
                  return { ...prev, segments };
                });
              }

              // HANDLE ANY OTHER TEXT FORMAT AS FALLBACK
              else if (
                jsonData.content &&
                typeof jsonData.content === "string"
              ) {
                setCurrentAssistantMessage((prev) => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];

                  if (
                    segments.length > 0 &&
                    segments[segments.length - 1].type === "text"
                  ) {
                    const lastSegment = segments[
                      segments.length - 1
                    ] as TextSegment;
                    segments[segments.length - 1] = {
                      ...lastSegment,
                      content: lastSegment.content + jsonData.content,
                    };
                  } else {
                    segments.push({ type: "text", content: jsonData.content });
                  }
                  
                  if (playResponseTTS) {
                    ttsPlayer.addText(jsonData.content);
                  }

                  return { ...prev, segments };
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      setCurrentAssistantMessage((prev) => {
        if (!prev) return prev;
        setMessages((messages) => [...messages, prev]);
        if (playResponseTTS) {
          ttsPlayer.finalizeStream(); // Finalize TTS stream only if it was played
        }
        return null;
      });
    } catch (error) {
      console.error("Error fetching AI response:", error);

      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        segments: [
          {
            type: "text",
            content: `Sorry, I encountered an error: ${error.message || "Unknown error"}`,
          },
        ],
      };

      setMessages((prev) => [...prev, errorMessage]);
      setCurrentAssistantMessage(null);
      // Don't finalize here if it wasn't playing
      // ttsPlayer state (enabled/disabled) is managed by isListening state now.
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check if Enter is pressed without modifier keys
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
    // Check if Cmd+Enter (Mac) or Ctrl+Enter (Windows) is pressed
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Allow default behavior (new line)
      return;
    }
  };

  // Render message segments
  const renderSegments = (segments: MessageSegment[], messageId: string) => {
    return segments.map((segment, index) => {
      if (segment.type === "text") {
        return (
          <Box key={index}>
            <MarkdownRenderer content={(segment as TextSegment).content} />
          </Box>
        );
      } else if (segment.type === "tool_call") {
        const toolSegment = segment as ToolCallSegment;
        return (
          <Box
            key={toolSegment.id}
            mt="xs"
            mb="xs"
            style={{
              border: "1px solid var(--mantine-color-gray-3)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <Group
              p="xs"
              onClick={(e) => toggleToolCall(messageId, toolSegment.id, e)}
              style={{
                cursor: "pointer",
                background: "var(--mantine-color-gray-1)",
              }}
            >
              <IconTools size={16} />
              <Text size="sm" fw={500} style={{ flex: 1 }}>
                Tool call: {toolSegment.name}
              </Text>
              {toolSegment.isOpen ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </Group>
            <Collapse in={toolSegment.isOpen}>
              <Box
                style={{
                  fontFamily: "monospace",
                  background: "var(--mantine-color-gray-0)",
                }}
              >
                <Box
                  p="xs"
                  style={{
                    borderBottom: toolSegment.result
                      ? "1px solid var(--mantine-color-gray-3)"
                      : "none",
                  }}
                >
                  <Text size="xs" fw={500} pb={2}>
                    Arguments:
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.1,
                    }}
                  >
                    {toolSegment.data}
                  </Text>
                </Box>
                {toolSegment.result && (
                  <Box p="xs">
                    <Text size="xs" fw={500} pb={2}>
                      Result:
                    </Text>
                    <Text
                      size="xs"
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.1,
                      }}
                    >
                      {toolSegment.result}
                    </Text>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        );
      }
      return null;
    });
  };

  return (
    <Box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        padding: "0",
      }}
    >
      <ScrollArea
        style={{ flex: 1 }}
        scrollbarSize={5}
        type="scroll"
        viewportRef={(ref) => {
          scrollRef.current = ref;
        }}
      >
        <Stack gap="xs" p="xs">
          {messages.map((message) => (
            <Box
              key={message.id}
              p="xs"
              style={{
                background:
                  message.role === "user"
                    ? "var(--mantine-color-blue-0)"
                    : "transparent",
                borderRadius: "8px",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              <Text
                size="xs"
                fw={500}
                mb={1}
                style={{ fontSize: "13px", lineHeight: 1.2 }}
              >
                {message.role === "user" ? "You" : "AI Assistant"}
              </Text>

              {message.role === "user" ? (
                <Box mt="xs">
                  <Text size="sm" style={{ fontSize: "15px", lineHeight: 1.2 }}>
                    {(message.segments[0] as TextSegment).content}
                  </Text>
                </Box>
              ) : (
                renderSegments(message.segments, message.id)
              )}
            </Box>
          ))}

          {currentAssistantMessage && (
            <Box
              p="xs"
              style={{
                borderRadius: "8px",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              <Text
                size="xs"
                fw={500}
                mb={1}
                style={{ fontSize: "13px", lineHeight: 1.2 }}
              >
                AI Assistant
              </Text>
              {renderSegments(
                currentAssistantMessage.segments,
                currentAssistantMessage.id,
              )}
            </Box>
          )}

          {isLoading &&
            (!currentAssistantMessage ||
              currentAssistantMessage.segments.length === 0) && (
              <Box p="xs">
                <Group align="center" gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    Thinking...
                  </Text>
                </Group>
              </Box>
            )}
        </Stack>
      </ScrollArea>

      <Box
        p="md"
        style={{ 
          borderTop: "1px solid var(--mantine-color-gray-2)",
          width: "100%"
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", width: "100%" }}>
          <Textarea
            placeholder="Ask AI anything... (Press Enter to send, Cmd/Ctrl+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{ flex: 1, width: "100%" }}
            autosize
            minRows={4}
          />
          <Stack gap="xs" style={{ justifyContent: "center" }}>
            <Button
              type="button"
              variant="light"
              color={isListening ? "red" : "blue"}
              onClick={toggleListening}
              disabled={isLoading}
              size="xs"
              px="xs"
            >
              {isListening ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
            </Button>
            <Button
              type="submit"
              variant="light"
              disabled={isLoading || !input.trim()}
              size="xs"
              px="xs"
            >
              <IconSend size={16} />
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}
