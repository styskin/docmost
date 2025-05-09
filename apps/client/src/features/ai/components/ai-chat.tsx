import React, { useState, useRef, useEffect } from "react";
import { Box, Button, ScrollArea, Stack, Text, TextInput, Group } from "@mantine/core";
import { IconSend, IconWand, IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import { ISuggestion } from "@/features/comment/types/comment.types";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";

// Add Web Speech API type declarations
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: {
    transcript: string;
  };
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
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

type EditorWithSuggestionCommands = any & {
  commands: any & SuggestionCommands;
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
  const [suggestions, setSuggestions] = useState<ISuggestion[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editor = useAtomValue(pageEditorAtom) as EditorWithSuggestionCommands | null;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const synth = window.speechSynthesis;
  const isListeningRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

      // console.log("Response: ", JSON.stringify(data, null, 2));

      // Convert snake_case to camelCase for suggestions
      // const formattedSuggestions = data.data.suggestions.map(suggestion => ({
      //   textToReplace: suggestion.text_to_replace,
      //   textReplacement: suggestion.text_replacement,
      //   reason: suggestion.reason,
      //   textBefore: suggestion.text_before,
      //   textAfter: suggestion.text_after,
      // }));
      
      // setSuggestions(formattedSuggestions);
      
      return data.data.text;
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      return null;
    }
  };

  useEffect(() => {
    // Initialize speech recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      console.log('Speech recognition is supported');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        isListeningRef.current = true;
      };

      recognitionRef.current.onresult = (event) => {
        console.log('Speech recognition result:', event);
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        console.log('Current transcript:', transcript);
        
        // Stop any ongoing speech synthesis when new phrases are detected
        if (synth && synth.speaking) {
          console.log('Stopping ongoing speech synthesis due to new phrase detection');
          synth.cancel();
          setIsSpeaking(false);
        }
        
        // Only update transcript if it's final
        if (event.results[current].isFinal) {
          setTranscript(transcript);
          if (transcript.trim()) {
            console.log('Submitting final transcript:', transcript);
            // Store the transcript before clearing it
            const finalTranscript = transcript;
            // Clear the transcript
            setTranscript("");
            // Submit with the stored transcript
            handleSubmit(new Event('submit') as any, false, finalTranscript);
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Only stop if it's a fatal error that can't be recovered from
        if (event.error === 'audio-capture' || event.error === 'not-allowed') {
          console.log('Fatal error, stopping recognition');
          isListeningRef.current = false;
          setIsListening(false);
        } else {
          // For other errors (like no-speech), try to restart
          console.log('Non-fatal error, attempting to restart recognition');
          try {
            if (isListeningRef.current) {
              recognitionRef.current?.start();
            }
          } catch (error) {
            console.error('Error restarting recognition:', error);
          }
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended, isListening:', isListeningRef.current);
        if (isListeningRef.current) {
          console.log('Restarting speech recognition');
          try {
            recognitionRef.current?.start();
          } catch (error) {
            console.error('Error restarting speech recognition:', error);
            // Only stop if we can't restart
            isListeningRef.current = false;
            setIsListening(false);
          }
        }
      };
    } else {
      console.log('Speech recognition is not supported in this browser');
    }

    return () => {
      console.log('Cleaning up speech recognition');
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Function to restart speech recognition
  const restartSpeechRecognition = () => {
    console.log('Restarting speech recognition');
    if (!recognitionRef.current || !isListeningRef.current) {
      console.log('Cannot restart: recognition not initialized or not in listening mode');
      return;
    }

    try {
      recognitionRef.current.stop();
      // Force a small delay to ensure clean state
      setTimeout(() => {
        if (isListeningRef.current) {
          recognitionRef.current?.start();
          console.log('Speech recognition restarted successfully');
        }
      }, 300);
    } catch (error) {
      console.error('Error restarting speech recognition:', error);
    }
  };

  // Function to speak text
  const speakText = (text: string) => {
    // Only speak if microphone is active
    if (synth && isListeningRef.current) {
      console.log('Speaking response as microphone is active');
      // Cancel any ongoing speech
      synth.cancel();
      setIsSpeaking(true);
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.onend = () => {
        console.log('Speech synthesis ended');
        setIsSpeaking(false);
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    } else {
      console.log('Skipping speech synthesis as microphone is not active');
    }
  };

  // Modified handleSubmit to include text-to-speech
  const handleSubmit = async (
    e: React.FormEvent | Event, 
    requestSuggestionsFlag = false,
    speechTranscript?: string
  ) => {
    if (e instanceof Event) {
      e.preventDefault();
    }
    
    const userInput = speechTranscript || input.trim() || transcript.trim();
    console.log('handleSubmit called with input:', userInput);
    if (!userInput || isLoading) {
      console.log('handleSubmit: skipping due to empty input or loading state');
      return;
    }
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userInput,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setTranscript("");
    setIsLoading(true);

    try {
      let responseContent;
      if (requestSuggestionsFlag) {
        // Request suggestions instead of normal response
        const context = "Context: "  + messages.map(m => `${m.role}: ${m.content}`).join("\n") + " Task: " + userInput;
        responseContent = await requestSuggestions(context);
        if (!responseContent) {
          responseContent = "Sorry, I couldn't generate suggestions for this content.";
        }
      } else {
        // Get the context from all previous messages
        const context = "Context: "  + messages.map(m => `${m.role}: ${m.content}`).join("\n");
        
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
            pageId: pageId,
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
        responseContent = "No response content found";
        
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
      }
      
      // Add AI response to chat
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: responseContent,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the response
      speakText(responseContent);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || "Unknown error"}`,
      };
      
      setMessages(prev => [...prev, errorMessage]);
      speakText(errorMessage.content);
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

  // Toggle listening function
  const toggleListening = () => {
    console.log('Toggle listening, current state:', isListening);
    if (!recognitionRef.current) {
      console.log('Speech recognition not initialized');
      return;
    }

    if (isListening) {
      console.log('Stopping speech recognition');
      isListeningRef.current = false;
      recognitionRef.current.stop();
    } else {
      console.log('Starting speech recognition');
      try {
        isListeningRef.current = true;
        recognitionRef.current.start();
        setTranscript("");
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        isListeningRef.current = false;
      }
    }
    setIsListening(!isListening);
  };

  // Add cleanup for speech synthesis
  useEffect(() => {
    return () => {
      if (synth) {
        synth.cancel();
      }
    };
  }, []);

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
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
          }} 
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          <TextInput
            placeholder={isListening ? "Listening..." : "Ask AI anything..."}
            value={isListening ? transcript : input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isLoading || isListening}
            style={{ flex: 1 }}
            size="sm"
          />
          <Stack gap="4px">
            <Button
              type="submit"
              variant="light"
              size="xs"
              disabled={isLoading || (!input.trim() && !transcript.trim())}
            >
              <IconSend size={16} />
            </Button>
            <Button
              variant="light"
              size="xs"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e, true);
              }}
              disabled={isLoading || (!input.trim() && !transcript.trim())}
              title="Generate suggestions for the document"
            >
              <IconWand size={16} />
            </Button>
            <Button
              variant={isListening ? "filled" : "light"}
              size="xs"
              onClick={toggleListening}
              title={isListening ? "Stop listening" : "Start listening"}
            >
              {isListening ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
            </Button>
          </Stack>
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
