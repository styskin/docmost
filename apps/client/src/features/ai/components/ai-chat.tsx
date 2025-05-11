import React, { useState, useRef, useEffect } from "react";
import { Box, Button, ScrollArea, Stack, Text, TextInput, Group, Collapse } from "@mantine/core";
import { IconSend, IconTools, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";


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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-message",
      role: "assistant",
      segments: [{ type: 'text', content: "How can I help you?" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const toggleToolCall = (messageId: string, toolId: string, event?: React.MouseEvent) => {
    // Prevent auto-scroll when manually toggling tool calls
    if (event) {
      event.stopPropagation();
      setShouldAutoScroll(false);
    }
    
    if (currentAssistantMessage && currentAssistantMessage.id === messageId) {
      setCurrentAssistantMessage(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          segments: prev.segments.map(segment => {
            if (segment.type === 'tool_call' && segment.id === toolId) {
              return { ...segment, isOpen: !segment.isOpen };
            }
            return segment;
          })
        };
      });
      return;
    }
    
    setMessages(prevMessages => 
      prevMessages.map(message => {
        if (message.id === messageId) {
          return {
            ...message,
            segments: message.segments.map(segment => {
              if (segment.type === 'tool_call' && segment.id === toolId) {
                return { ...segment, isOpen: !segment.isOpen };
              }
              return segment;
            })
          };
        }
        return message;
      })
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
    }
  }, [input]);

  // Submit handler that calls the server's Manul API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userInput = input.trim();
    if (!userInput || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      segments: [{ type: 'text', content: userInput }],
    };
    
    const context = "Context: " + messages.map(m => 
      `${m.role}: ${m.segments.map(s => 
        s.type === 'text' ? (s as TextSegment).content : ''
      ).join('')}`
    ).join("\n") + " Task: " + userInput;
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
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
        body: JSON.stringify({ query: userInput, context }),
      });
      
      if (!response.ok) throw new Error(`Failed to get response: ${response.status}`);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      
      const decoder = new TextDecoder();
      let partialChunk = '';
      let currentToolId: string | null = null;
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        partialChunk += chunk;
        
        while (partialChunk.includes('\n\n')) {
          const eventEnd = partialChunk.indexOf('\n\n');
          const eventData = partialChunk.substring(0, eventEnd);
          partialChunk = partialChunk.substring(eventEnd + 2);
          
          if (eventData.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(eventData.slice(6));
              console.log('STREAM DATA:', jsonData); // Debug the incoming data
              

              // HANDLE TOOL CALL CHUNKS: {"tool_call_chunks": [{"name": null, "args": "{\"workspace\"", "id": null, "index": 1, "type": "tool_call_chunk"}]}
              if (jsonData.tool_call_chunks && Array.isArray(jsonData.tool_call_chunks)) {
                setCurrentAssistantMessage(prev => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];
                  
                  for (const chunk of jsonData.tool_call_chunks) {
                    // New tool call with ID and name
                    if (chunk.id && chunk.name) {
                      currentToolId = chunk.id;
                      segments.push({
                        type: 'tool_call',
                        id: chunk.id,
                        name: chunk.name,
                        data: chunk.args || '',
                        isOpen: false
                      } as ToolCallSegment);
                    } 
                    // Continuation of existing tool call
                    else if (chunk.args !== undefined) {
                      // If we have a current tool ID, try to find that specific tool call
                      if (currentToolId) {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (segments[i].type === 'tool_call' && (segments[i] as ToolCallSegment).id === currentToolId) {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data: toolSegment.data + (chunk.args || '')
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      } 
                      // Otherwise find the most recent tool call
                      else {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (segments[i].type === 'tool_call') {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data: toolSegment.data + (chunk.args || '')
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      }
                    }
                  }
                  
                  console.log('UPDATED TOOL CHUNKS:', segments);
                  return { ...prev, segments };
                });
              }
              
              // HANDLE TEXT: {'content': [{'text': 'I', 'type': 'text', 'index': 0}]}
              else if (jsonData.content && Array.isArray(jsonData.content)) {
                setCurrentAssistantMessage(prev => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];
                  
                  // Process text content
                  for (const item of jsonData.content) {
                    if (item.type === 'text' && item.text !== undefined) {
                      // If already have a text segment, append to it
                      if (segments.length > 0 && segments[segments.length - 1].type === 'text') {
                        const lastSegment = segments[segments.length - 1] as TextSegment;
                        segments[segments.length - 1] = {
                          ...lastSegment,
                          content: lastSegment.content + item.text
                        };
                      }
                      // Otherwise create a new text segment
                      else {
                        segments.push({ 
                          type: 'text', 
                          content: item.text 
                        });
                      }
                    }
                    
                    // Process tool_use content in the same update
                    if (item.type === 'tool_use') {
                      if (item.id && item.name) {
                        currentToolId = item.id;
                        segments.push({
                          type: 'tool_call',
                          id: item.id,
                          name: item.name,
                          data: item.partial_json || '',
                          isOpen: false
                        } as ToolCallSegment);
                      } 
                      else if (item.partial_json !== undefined) {
                        for (let i = segments.length - 1; i >= 0; i--) {
                          if (segments[i].type === 'tool_call') {
                            const toolSegment = segments[i] as ToolCallSegment;
                            segments[i] = {
                              ...toolSegment,
                              data: toolSegment.data + (item.partial_json || '')
                            } as ToolCallSegment;
                            break;
                          }
                        }
                      }
                    }
                  }
                  
                  console.log('UPDATED SEGMENTS:', segments);
                  return { ...prev, segments };
                });
              }
              
              // HANDLE TOOL RESPONSE: {"content": "[\n  {\n    "id": "0196...",...}]", "tool_call_id": "toolu_..."}
              else if (jsonData.tool_call_id && jsonData.content) {
                setCurrentAssistantMessage(prev => {
                  if (!prev) return prev;
                  
                  const segments = [...prev.segments];
                  for (let i = 0; i < segments.length; i++) {
                    if (segments[i].type === 'tool_call' && (segments[i] as ToolCallSegment).id === jsonData.tool_call_id) {
                      segments[i] = { 
                        ...(segments[i] as ToolCallSegment), 
                        result: jsonData.content 
                      } as ToolCallSegment;
                      break;
                    }
                  }
                  
                  console.log('UPDATED TOOL RESPONSE:', segments);
                  return { ...prev, segments };
                });
              }
              
              // HANDLE ANY OTHER TEXT FORMAT AS FALLBACK
              else if (jsonData.content && typeof jsonData.content === 'string') {
                setCurrentAssistantMessage(prev => {
                  if (!prev) return prev;
                  const segments = [...prev.segments];
                  
                  if (segments.length > 0 && segments[segments.length - 1].type === 'text') {
                    const lastSegment = segments[segments.length - 1] as TextSegment;
                    segments[segments.length - 1] = {
                      ...lastSegment,
                      content: lastSegment.content + jsonData.content
                    };
                  } else {
                    segments.push({ type: 'text', content: jsonData.content });
                  }
                  
                  return { ...prev, segments };
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
      
      setCurrentAssistantMessage(prev => {
        if (!prev) return prev;
        setMessages(messages => [...messages, prev]);
        return null;
      });
    } catch (error) {
      console.error("Error fetching AI response:", error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        segments: [{ type: 'text', content: `Sorry, I encountered an error: ${error.message || "Unknown error"}` }],
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setCurrentAssistantMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Render message segments
  const renderSegments = (segments: MessageSegment[], messageId: string) => {
    return segments.map((segment, index) => {
      if (segment.type === 'text') {
        return (
          <Box key={index}>
            <MarkdownRenderer content={(segment as TextSegment).content} />
          </Box>
        );
      } else if (segment.type === 'tool_call') {
        const toolSegment = segment as ToolCallSegment;
        return (
          <Box key={toolSegment.id} mt="xs" mb="xs" 
            style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: "4px", overflow: "hidden" }}>
            <Group p="xs" onClick={(e) => toggleToolCall(messageId, toolSegment.id, e)} 
              style={{ cursor: "pointer", background: "var(--mantine-color-gray-1)" }}>
              <IconTools size={16} />
              <Text size="sm" fw={500} style={{ flex: 1 }}>Tool call: {toolSegment.name}</Text>
              {toolSegment.isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </Group>
            <Collapse in={toolSegment.isOpen}>
              <Box style={{ fontFamily: "monospace", background: "var(--mantine-color-gray-0)" }}>
                <Box p="xs" style={{ borderBottom: toolSegment.result ? "1px solid var(--mantine-color-gray-3)" : "none" }}>
                  <Text size="xs" fw={500} pb={2}>Arguments:</Text>
                  <Text size="xs" style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.1 }}>{toolSegment.data}</Text>
                </Box>
                {toolSegment.result && (
                  <Box p="xs">
                    <Text size="xs" fw={500} pb={2}>Result:</Text>
                    <Text size="xs" style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.1 }}>{toolSegment.result}</Text>
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
    <Box style={{ 
      position: "absolute", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      display: "flex", 
      flexDirection: "column",
      padding: "0"
    }}>
      <ScrollArea
        style={{ flex: 1 }}
        scrollbarSize={5}
        type="scroll"
        viewportRef={ref => { scrollRef.current = ref; }}
      >
        <Stack gap="xs" p="xs">
          {messages.map(message => (
            <Box key={message.id} p="xs" style={{
              background: message.role === "user" ? "var(--mantine-color-blue-0)" : "transparent",
              borderRadius: "8px",
              maxWidth: "100%",
              wordBreak: "break-word",
            }}>
              <Text size="xs" fw={500} mb={1} style={{ fontSize: "13px", lineHeight: 1.2 }}>
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
            <Box p="xs" style={{ borderRadius: "8px", maxWidth: "100%", wordBreak: "break-word" }}>
              <Text size="xs" fw={500} mb={1} style={{ fontSize: "13px", lineHeight: 1.2 }}>
                AI Assistant
              </Text>
              {renderSegments(currentAssistantMessage.segments, currentAssistantMessage.id)}
            </Box>
          )}
          
          {isLoading && !currentAssistantMessage && (
            <Box p="xs">
              <Text size="sm" c="dimmed">AI is thinking...</Text>
            </Box>
          )}
        </Stack>
      </ScrollArea>

      <Box p="md" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex" }}>
          <TextInput
            placeholder="Ask AI anything..."
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="light" ml="xs" disabled={isLoading || !input.trim()}>
            <IconSend size={18} />
          </Button>
        </form>
      </Box>
    </Box>
  );
}
