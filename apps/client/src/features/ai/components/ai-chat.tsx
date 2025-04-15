import React, { useState, useRef, useEffect } from "react";
import { Box, Button, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";

// Message type definition
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Submit handler that calls the server's Manul API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userInput = input.trim();
    if (!userInput || isLoading) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userInput,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    try {
      // Get the context from all previous messages
      const context = messages.map(m => `${m.role}: ${m.content}`).join("\n");
      
      console.log("Sending request to Manul API:", { query: userInput, context });
      
      // Call Manul API
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
      
      console.log("Raw response:", response);
      
      if (!response.ok) {
        console.error("Response not OK:", response.status, response.statusText);
        throw new Error(`Failed to get response from AI: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Parsed response data:", data);
      
      // Determine the response content from various possible structures
      let responseContent = "No response content found";
      
      // Check for Manul API format: {"data":{"response":"..."},"success":true,"status":201}
      if (data?.data?.response && typeof data.data.response === 'string') {
        console.log("Found Manul API format response");
        responseContent = data.data.response;
      }
      // Check for direct response property (previous expected format)
      else if (typeof data.response === 'string') {
        console.log("Found direct response property");
        responseContent = data.response;
      } 
      // Check for AI SDK format with choices array
      else if (data?.choices?.[0]?.message?.content) {
        console.log("Found AI SDK format response");
        responseContent = data.choices[0].message.content;
      } 
      // Fallback with warning
      else {
        console.warn("Unexpected response structure:", data);
        responseContent = "Received response in unexpected format: " + JSON.stringify(data);
      }
      
      // Add AI response to chat
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: responseContent,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
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
    }
  };

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
          {isLoading && (
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
        </form>
      </Box>
    </Box>
  );
}
