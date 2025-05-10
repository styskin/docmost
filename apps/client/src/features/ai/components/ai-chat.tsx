import React, { useState, useRef, useEffect } from "react";
import { Box, Button, ScrollArea, Stack, Text, TextInput, Group } from "@mantine/core";
import { IconSend, IconWand } from "@tabler/icons-react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import { ISuggestion } from "@/features/comment/types/comment.types";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";


// Message type definition
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Editor with suggestion commands
interface SuggestionCommands {
  setSuggestionMode: (
    suggestions: ISuggestion[] | undefined | null,
    username: string,
  ) => void;
  unsetSuggestionMode: () => void;
}

type EditorWithSuggestionCommands = {
  commands: SuggestionCommands;
};

export function AIChat() {
  // State management
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-message",
      role: "assistant",
      content: "Hi, I'm your AI assistant. How can I help you?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [suggestions, setSuggestions] = useState<ISuggestion[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editor = useAtomValue(pageEditorAtom) as EditorWithSuggestionCommands | null;

  const { pageSlug } = useParams<{ pageSlug: string }>();
  const pageId = pageSlug ? extractPageSlugId(pageSlug) : null;

  // Function to request suggestions
  const requestSuggestions = async (userInput: string) => {
    try {
      // Extract page ID and workspace ID from URL
            
      console.log("Requesting suggestions for page:", pageId);
      
      const response = await fetch("/api/manul/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId,
          prompt: userInput,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get suggestions: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data.text;
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return null;
    }
  };

  // Auto-scroll to the bottom when new messages arrive or streaming content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Submit handler that calls the server's Manul API
  const handleSubmit = async (e: React.FormEvent, requestSuggestionsFlag = false) => {
    e.preventDefault();
    
    const userInput = input.trim();
    if (!userInput || isLoading) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userInput,
    };
    
    const context = "Context: "  + messages.map(m => `${m.role}: ${m.content}`).join("\n") + " Task: " + userInput;
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent(""); // Reset streaming content

    try {
      let responseContent;
      
      if (requestSuggestionsFlag) {
        // Request suggestions instead of normal response
        responseContent = await requestSuggestions(context);
        if (!responseContent) {
          responseContent = "Sorry, I couldn't generate suggestions for this content.";
        }
        
        // Add AI response to chat
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: responseContent,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Use streaming API for regular chat responses
        const response = await fetch("/api/manul/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userInput,
            context: context,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get response: ${response.status}`);
        }
        
        // Process the streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');
        
        const decoder = new TextDecoder();
        let partialChunk = '';
        let fullStreamingContent = '';
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          // Decode the chunk and append to partial chunk
          const chunk = decoder.decode(value, { stream: true });
          partialChunk += chunk;
          
          // Process any complete SSE messages in the partial chunk
          while (partialChunk.includes('\n\n')) {
            const eventEnd = partialChunk.indexOf('\n\n');
            const eventData = partialChunk.substring(0, eventEnd);
            partialChunk = partialChunk.substring(eventEnd + 2);
            
            if (eventData.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(eventData.slice(6));
                if (jsonData.content) {
                  fullStreamingContent += jsonData.content;
                  setStreamingContent(fullStreamingContent);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
        
        // Once streaming is complete, add the full message to the chat
        if (fullStreamingContent) {
          const assistantMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: fullStreamingContent,
          };
          
          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      
      // Add error message to chat with more details
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || "Unknown error"}`,
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent(""); // Clear streaming content after it's added to messages
    }
  };

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "85vh" }}>
      <ScrollArea
        style={{ flex: 1 }}
        scrollbarSize={5}
        type="scroll"
        viewportRef={(ref) => {
          scrollRef.current = ref;
        }}
      >
        <Stack gap="md" p="xs">
          {messages.map((message) => (
            <Box
              key={message.id}
              p="md"
              style={{
                background: message.role === "user" ? "var(--mantine-color-blue-0)" : "transparent",
                borderRadius: "8px",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              <Text size="sm" fw={500} mb={4}>
                {message.role === "user" ? "You" : "AI Assistant"}
              </Text>
              {message.role === "user" ? (
                <Text size="sm">{message.content}</Text>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </Box>
          ))}
          
          {/* Streaming content display */}
          {streamingContent && (
            <Box
              p="md"
              style={{
                borderRadius: "8px",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              <Text size="sm" fw={500} mb={4}>
                AI Assistant
              </Text>
              <MarkdownRenderer content={streamingContent} />
            </Box>
          )}
          
          {isLoading && !streamingContent && (
            <Box p="md">
              <Text size="sm" c="dimmed">
                AI is thinking...
              </Text>
            </Box>
          )}
        </Stack>
      </ScrollArea>

      <Box p="md">
        <form onSubmit={handleSubmit} style={{ display: "flex" }}>
          <TextInput
            placeholder="Ask AI anything..."
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <Button
            type="submit"
            variant="light"
            ml="xs"
            disabled={isLoading || !input.trim()}
          >
            <IconSend size={18} />
          </Button>
          <Button
            variant="light"
            ml="xs"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e, true);
            }}
            disabled={isLoading || !input.trim()}
            title="Generate suggestions for the document"
          >
            <IconWand size={18} />
          </Button>
        </form>
        
        {suggestions.length > 0 && (
          <Box mt="md">
            <Group justify="space-between">
              <Text size="sm" fw={500}>Suggestions</Text>
              <Button 
                size="xs" 
                variant="subtle"
                onClick={() => {
                  if (suggestionMode) {
                    if (editor?.commands?.unsetSuggestionMode) {
                      editor.commands.unsetSuggestionMode();
                      setSuggestionMode(false);
                    }
                  } else {
                    if (editor?.commands?.setSuggestionMode) {
                      editor.commands.setSuggestionMode(suggestions, "AI Assistant");
                      setSuggestionMode(true);
                    }
                  }
                }}
              >
                {suggestionMode ? "Hide Suggestions" : "Show Suggestions"}
              </Button>
            </Group>
          </Box>
        )}
      </Box>
    </Box>
  );
}
