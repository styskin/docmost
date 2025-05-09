import React, { useState, useRef, useEffect } from "react";
import { Box, Button, ScrollArea, Stack, Text, Textarea, Group } from "@mantine/core";
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
  const isSpeakingRef = useRef(isSpeaking);
  const recognitionActiveRef = useRef(false); // Tracks if recognition is actually running
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

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

  // Function to check microphone permission
  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(result.state);
      
      result.addEventListener('change', () => {
        setMicPermission(result.state);
      });
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      setMicPermission('prompt');
    }
  };

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  // Helper function to safely start speech recognition
  const safelyStartRecognition = () => {
    if (!recognitionRef.current) {
      console.log(`[${Date.now()}] safelyStartRecognition: No recognition instance available`);
      return false;
    }
    
    // Only start if it's not already active
    if (recognitionActiveRef.current) {
      console.log(`[${Date.now()}] safelyStartRecognition: Recognition is already active, no need to start`);
      return true; // Already running
    }
    
    try {
      console.log(`[${Date.now()}] safelyStartRecognition: Attempting to start recognition`);
      recognitionRef.current.start();
      recognitionActiveRef.current = true;
      isListeningRef.current = true;
      setIsListening(true);
      console.log(`[${Date.now()}] safelyStartRecognition: Recognition started successfully`);
      return true;
    } catch (e) {
      console.error(`[${Date.now()}] safelyStartRecognition: Error starting recognition:`, e);
      return false;
    }
  };
  
  // Helper function to safely stop speech recognition
  const safelyStopRecognition = () => {
    if (!recognitionRef.current) {
      console.log(`[${Date.now()}] safelyStopRecognition: No recognition instance available`);
      return false;
    }
    
    // Only stop if it's actually active
    if (!recognitionActiveRef.current) {
      console.log(`[${Date.now()}] safelyStopRecognition: Recognition is not active, no need to stop`);
      return true; // Already stopped
    }
    
    try {
      console.log(`[${Date.now()}] safelyStopRecognition: Stopping recognition`);
      recognitionRef.current.stop();
      recognitionActiveRef.current = false;
      console.log(`[${Date.now()}] safelyStopRecognition: Recognition stopped successfully`);
      return true;
    } catch (e) {
      console.error(`[${Date.now()}] safelyStopRecognition: Error stopping recognition:`, e);
      recognitionActiveRef.current = false; // Force the state to match our attempt
      return false;
    }
  };

  // Update isSpeakingRef whenever isSpeaking changes
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    
    // When speaking ends, check if we need to restart speech recognition
    if (!isSpeaking && isListeningRef.current) {
      console.log(`[${Date.now()}] isSpeaking useEffect: isSpeaking became false, attempting to restart recognition`);
      // Small delay to avoid conflicts with any other cleanup
      setTimeout(() => {
        if (isListeningRef.current) {
          safelyStartRecognition();
        }
      }, 300);
    }
  }, [isSpeaking]);

  useEffect(() => {
    // Initialize speech recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      console.log(`[${Date.now()}] SpeechRec Effect: Initializing/Re-initializing (isSpeaking: ${isSpeaking} or mount).`);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) { // Create instance only if it doesn't exist
        console.log(`[${Date.now()}] SpeechRec Effect: Creating new SpeechRecognition instance.`);
        recognitionRef.current = new SpeechRecognition();
      }
      
      const rec = recognitionRef.current; // Use a local const for the current instance
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        console.log(`[${Date.now()}] SpeechRec Event: onstart`);
        recognitionActiveRef.current = true;
        isListeningRef.current = true;
        setIsListening(true); // Sync UI
      };

      rec.onresult = (event) => {
        console.log(`[${Date.now()}] SpeechRec Event: onresult. Final: ${event.results[event.resultIndex].isFinal}`);
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        console.log(`[${Date.now()}] Current transcript: ${transcript}`);
        
        if (synth && synth.speaking) {
          console.log(`[${Date.now()}] SpeechRec Event: onresult - Stopping ongoing speech synthesis due to new phrase detection`);
          synth.cancel();
          setIsSpeaking(false); 
        }
        
        if (event.results[current].isFinal) {
          setTranscript(transcript);
          if (transcript.trim()) {
            console.log(`[${Date.now()}] SpeechRec Event: onresult - Submitting final transcript: ${transcript}`);
            const finalTranscript = transcript;
            setTranscript("");
            handleSubmit(new Event('submit') as any, false, finalTranscript);
          }
        }
      };

      rec.onerror = (event) => {
        console.error(`[${Date.now()}] SpeechRec Event: onerror - Error: ${event.error}`);
        // Mark recognition as not active on fatal errors
        if (event.error === 'audio-capture' || event.error === 'not-allowed' || event.error === 'network') {
          console.log(`[${Date.now()}] SpeechRec Event: onerror - Fatal error, stopping recognition.`);
          recognitionActiveRef.current = false;
          isListeningRef.current = false;
          setIsListening(false); // Sync UI
        } else if (event.error === 'no-speech') {
          // no-speech is common and not fatal
          console.log(`[${Date.now()}] SpeechRec Event: onerror - No speech detected, continuing.`);
        } else {
          console.log(`[${Date.now()}] SpeechRec Event: onerror - Non-fatal error. Current state: isListeningRef=${isListeningRef.current}, recognitionActive=${recognitionActiveRef.current}`);
          // For non-fatal errors, only try to restart if we think it should be listening but recognition isn't active
          if (isListeningRef.current && !recognitionActiveRef.current && !isSpeakingRef.current) {
            console.log(`[${Date.now()}] SpeechRec Event: onerror - Attempting to restart after non-fatal error`);
            safelyStartRecognition();
          }
        }
      };

      rec.onend = () => {
        console.log(`[${Date.now()}] SpeechRec Event: onend. State: isListeningRef=${isListeningRef.current}, recognitionActive=${recognitionActiveRef.current}`);
        recognitionActiveRef.current = false;
        
        // Only auto-restart if intended to be listening and not currently speaking
        if (isListeningRef.current && !isSpeakingRef.current) {
          console.log(`[${Date.now()}] SpeechRec Event: onend - Attempting to restart recognition.`);
          setTimeout(() => {
            if (isListeningRef.current && !recognitionActiveRef.current) {
              safelyStartRecognition();
            }
          }, 300);
        } else {
          console.log(`[${Date.now()}] SpeechRec Event: onend - Not restarting. TTS active: ${isSpeakingRef.current}, User intended listen: ${isListeningRef.current}`);
          // If not restarting because user stopped (isListeningRef is false), ensure UI reflects this.
          if (!isListeningRef.current) {
            setIsListening(false);
          }
        }
      };
    } else {
      console.log(`[${Date.now()}] SpeechRec Effect: Speech recognition not supported in this browser.`);
    }

    return () => {
      console.log(`[${Date.now()}] SpeechRec Effect: Cleanup (isSpeaking: ${isSpeaking} or unmount). isListeningRef=${isListeningRef.current}`);
      
      setTimeout(() => {
        console.log(`[${Date.now()}] SpeechRec Effect: Cleanup - Executing stop logic.`);
        safelyStopRecognition();
      }, isSpeaking ? 500 : 0); // Small delay if we're starting to speak
    };
  }, [isSpeaking]);

  // Additional helper function to stop ongoing TTS
  const stopSpeaking = () => {
    console.log(`[${Date.now()}] stopSpeaking: Stopping any ongoing TTS playback`);
    
    // Stop the audio element
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Force resources to be released
        console.log(`[${Date.now()}] stopSpeaking: Audio element stopped`);
      } catch (e) {
        console.error(`[${Date.now()}] stopSpeaking: Error stopping audio:`, e);
      }
    }
    
    // Update state
    setIsSpeaking(false);
  };

  // Modified handleSubmit with interrupt capability
  const handleSubmit = async (
    e: React.FormEvent | Event, 
    requestSuggestionsFlag = false,
    speechTranscript?: string
  ) => {
    if (e instanceof Event) {
      e.preventDefault();
    }
    
    const userInput = speechTranscript || input.trim() || transcript.trim();
    const wasVoiceInput = !!speechTranscript || (isListening && transcript.trim() === userInput); 
    
    console.log(`[${Date.now()}] handleSubmit called with input: "${userInput}", wasVoiceInput: ${wasVoiceInput}, isLoading: ${isLoading}, isSpeaking: ${isSpeaking}`);
    
    // Skip empty inputs
    if (!userInput) {
      console.log(`[${Date.now()}] handleSubmit: skipping due to empty input`);
      return;
    }
    
    // For voice inputs specifically, interrupt ongoing TTS and cancel loading state
    const isInterruption = wasVoiceInput && (isLoading || isSpeaking);
    if (isInterruption) {
      console.log(`[${Date.now()}] handleSubmit: Voice interruption detected - cancelling current response`);
      
      // Stop any current TTS
      stopSpeaking();
    } else if (isLoading && !isInterruption) {
      // For non-interruptions, still skip if loading
      console.log(`[${Date.now()}] handleSubmit: skipping due to loading state (not an interruption)`);
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
      
      // Speak the response only if the input was from voice
      if (wasVoiceInput) {
        console.log(`[${Date.now()}] handleSubmit: Input was from voice, attempting to speak response.`);
        await speakText(responseContent);
      } else {
        console.log(`[${Date.now()}] handleSubmit: Input was text, not speaking AI response.`);
      }
    } catch (error) {
      console.error(`[${Date.now()}] Error fetching AI response:`, error);
      
      const errorMessageContent = `Sorry, I encountered an error: ${error.message || "Unknown error"}`;
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: errorMessageContent,
      };
      
      setMessages(prev => [...prev, errorMessage]);
      // Speak the error message only if the original input was from voice
      if (wasVoiceInput) {
        console.log(`[${Date.now()}] handleSubmit: Input was from voice, attempting to speak error message.`);
        await speakText(errorMessageContent);
      } else {
        console.log(`[${Date.now()}] handleSubmit: Input was text, not speaking error message.`);
      }
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

  // Modified toggleListening function with permission handling
  const toggleListening = async () => {
    console.log(`[${Date.now()}] toggleListening: Current state - isListening=${isListening}, recognitionActive=${recognitionActiveRef.current}`);
    
    if (micPermission === 'denied') {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Microphone access is denied. Please enable microphone access in your browser settings to use voice commands.",
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    if (isListening) {
      console.log(`[${Date.now()}] toggleListening: Stopping speech recognition`);
      isListeningRef.current = false;
      safelyStopRecognition();
      setIsListening(false);
    } else {
      console.log(`[${Date.now()}] toggleListening: Starting speech recognition`);
      try {
        // Request microphone permission explicitly
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        
        isListeningRef.current = true;
        safelyStartRecognition();
      } catch (error) {
        console.error(`[${Date.now()}] toggleListening: Error starting speech recognition:`, error);
        isListeningRef.current = false;
        
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: "Could not access microphone. Please make sure you've granted microphone permissions in your browser settings.",
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Function to speak text using OpenAI TTS
  const speakText = async (text: string) => {
    const speakTextClientStartTime = Date.now();
    console.log(`[${speakTextClientStartTime}] speakText: Client-side processing initiated for text: "${text.substring(0, 50)}..."`);

    // Flag to track if we need to restart recognition after TTS
    const wasListeningBefore = isListeningRef.current;
    
    // More reliable restart helper that uses our new safe functions
    const restartRecognitionDuringTTS = () => {
      if (wasListeningBefore) {
        console.log(`[${Date.now()}] speakText: Attempting to restart recognition during TTS`);
        
        // Ensure recognition is stopped first (clean state)
        safelyStopRecognition();
        
        // Small delay before restart
        setTimeout(() => {
          if (wasListeningBefore) {
            console.log(`[${Date.now()}] speakText: Actually restarting recognition now`);
            safelyStartRecognition();
          }
        }, 100);
      }
    };

    try {
      // Set speaking flag
      setIsSpeaking(true); 
      console.log(`[${Date.now()}] speakText: setIsSpeaking(true) called. isSpeakingRef should update.`);

      // Wait a tick to allow state to propagate
      await Promise.resolve(); 

      console.log(`[${Date.now()}] speakText: Will attempt to keep speech recognition available during TTS`);

      console.log(`[${Date.now()}] speakText: Fetching TTS audio...`);
      const response = await fetch("/api/openai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }
      
      console.log(`[${Date.now()}] speakText: Response received, setting up streaming playback...`);
      
      // Clean up any existing audio element
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Force resources to be released
      }
      
      // Create a new audio element
      audioRef.current = new Audio();
      
      // Set up event handlers for the audio element
      const setupAudioElementHandlers = () => {
        if (!audioRef.current) return;
        
        audioRef.current.onended = () => {
          console.log(`[${Date.now()}] speakText: Audio playback ended`);
          setIsSpeaking(false);
          
          // After TTS finishes, restart speech recognition if it was active but stopped
          if (isListeningRef.current && recognitionRef.current) {
            console.log(`[${Date.now()}] speakText: Attempting to restart speech recognition after TTS (onended event)`);
            setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  safelyStartRecognition();
                } catch (e) {
                  console.error(`[${Date.now()}] speakText: Error restarting recognition:`, e);
                }
              }
            }, 200);
          }
        };
        
        audioRef.current.onerror = (error) => {
          console.error(`[${Date.now()}] speakText: Audio playback error:`, error);
          setIsSpeaking(false);
        };
      };
      
      setupAudioElementHandlers();
      
      // Try the streaming approach first
      try {
        console.log(`[${Date.now()}] speakText: Setting up MSE streaming...`);
        // Get the response body as a ReadableStream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }
        
        // Create a MediaSource instance
        const mediaSource = new MediaSource();
        audioRef.current.src = URL.createObjectURL(mediaSource);
        
        // Wait for the MediaSource to be open
        await new Promise<void>((resolve, reject) => {
          const openTimeout = setTimeout(() => {
            reject(new Error('MediaSource open timeout'));
          }, 2000);
          
          mediaSource.addEventListener('sourceopen', () => {
            clearTimeout(openTimeout);
            resolve();
          }, { once: true });
        });
        
        console.log(`[${Date.now()}] speakText: MediaSource opened, creating SourceBuffer...`);
        
        // Create a SourceBuffer
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        
        // We'll use this to track if we've started playing
        let playbackStarted = false;
        
        // Give a small delay before trying to play
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Function to process the stream chunks
        const processStream = async (): Promise<boolean> => {
          try {
            const chunks: Uint8Array[] = [];
            let totalSize = 0;
            
            // Try to get at least a small amount of data before starting playback
            const minimumDataToStart = 8192; // ~8KB should be enough for the MP3 header and initial audio data
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log(`[${Date.now()}] speakText: Stream completed`);
                break;
              }
              
              if (!value || value.byteLength === 0) {
                console.log(`[${Date.now()}] speakText: Received empty chunk, continuing...`);
                continue;
              }
              
              chunks.push(value);
              totalSize += value.byteLength;
              
              console.log(`[${Date.now()}] speakText: Received chunk of ${value.byteLength} bytes. Total: ${totalSize} bytes`);
              
              // Try to append the chunk to the SourceBuffer
              try {
                if (sourceBuffer.updating) {
                  console.log(`[${Date.now()}] speakText: SourceBuffer busy, waiting...`);
                  await new Promise<void>(resolve => {
                    sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
                  });
                }
                
                sourceBuffer.appendBuffer(value);
                
                // Wait for this append to complete
                await new Promise<void>(resolve => {
                  sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
                });
                
                console.log(`[${Date.now()}] speakText: Chunk appended successfully`);
                
                // Start playback once we have enough data and haven't started yet
                if (!playbackStarted && totalSize >= minimumDataToStart) {
                  playbackStarted = true;
                  console.log(`[${Date.now()}] speakText: Have minimum data (${totalSize} bytes), attempting to start playback...`);
                  
                  try {
                    await audioRef.current!.play();
                    console.log(`[${Date.now()}] speakText: Streaming playback started successfully!`);
                    
                    // Once playback has started, try to restart recognition
                    setTimeout(restartRecognitionDuringTTS, 300);
                    
                    // Set up periodic restart check but less aggressively
                    let restartAttempts = 0;
                    const restartInterval = setInterval(() => {
                      if (isSpeakingRef.current && wasListeningBefore && restartAttempts < 3) {
                        // Only do a few attempts to avoid overwhelming the browser
                        restartAttempts++;
                        console.log(`[${Date.now()}] speakText: Periodic recognition restart attempt ${restartAttempts} during ongoing TTS`);
                        restartRecognitionDuringTTS();
                      } else {
                        clearInterval(restartInterval);
                      }
                    }, 3000); // Less frequent checks
                    
                    // Clear interval after 10 seconds max
                    setTimeout(() => clearInterval(restartInterval), 10000);
                  } catch (playError) {
                    console.error(`[${Date.now()}] speakText: Error starting streaming playback:`, playError);
                    throw playError; // This will exit the MSE approach and try the fallback
                  }
                }
              } catch (appendError) {
                console.error(`[${Date.now()}] speakText: Error appending buffer:`, appendError);
                throw appendError;
              }
            }
            
            // Finalize the MediaSource after all chunks are processed
            if (mediaSource.readyState === 'open') {
              mediaSource.endOfStream();
              console.log(`[${Date.now()}] speakText: MediaSource closed properly`);
              
              // Set a timer to check if the audio has finished playing
              // This is a backup in case the onended event doesn't fire
              const checkAudioFinished = () => {
                if (audioRef.current) {
                  if (audioRef.current.ended || audioRef.current.paused || audioRef.current.currentTime >= audioRef.current.duration) {
                    console.log(`[${Date.now()}] speakText: Audio detected as finished via check`);
                    setIsSpeaking(false);
                    
                    // Ensure speech recognition is restarted
                    if (isListeningRef.current && recognitionRef.current) {
                      console.log(`[${Date.now()}] speakText: Attempting to restart speech recognition after streaming completed`);
                      setTimeout(() => {
                        if (isListeningRef.current && recognitionRef.current) {
                          try {
                            recognitionRef.current.start();
                          } catch (e) {
                            console.error(`[${Date.now()}] speakText: Error restarting recognition after streaming:`, e);
                          }
                        }
                      }, 200);
                    }
                  } else {
                    // If still playing, check again in half a second
                    setTimeout(checkAudioFinished, 500);
                  }
                }
              };
              
              // Start checking a second after we close the MediaSource
              setTimeout(checkAudioFinished, 1000);
            }
            
            return true; // Streaming was successful
          } catch (streamError) {
            console.error(`[${Date.now()}] speakText: Error in streaming process:`, streamError);
            // Try to clean up MediaSource
            try {
              if (mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
              }
            } catch (e) {
              console.error(`[${Date.now()}] speakText: Error closing MediaSource:`, e);
            }
            
            return false; // Signal that streaming failed
          }
        };
        
        // Start the streaming process
        const streamingSuccessful = await processStream();
        
        if (!streamingSuccessful) {
          throw new Error('Streaming approach failed, falling back to blob');
        }
      } catch (streamingError) {
        // If streaming failed, fall back to the blob approach
        console.warn(`[${Date.now()}] speakText: Streaming playback failed, falling back to blob approach: ${streamingError.message}`);
        
        // We need to fetch the audio data again since we consumed the stream in the first attempt
        console.log(`[${Date.now()}] speakText: Re-fetching TTS audio for fallback approach...`);
        const fallbackResponse = await fetch("/api/openai/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
          }),
        });
        
        if (!fallbackResponse.ok) {
          throw new Error(`TTS fallback request failed: ${fallbackResponse.status}`);
        }
        
        console.log(`[${Date.now()}] speakText: Fallback response received, collecting audio data...`);
        const audioBlob = await fallbackResponse.blob();
        console.log(`[${Date.now()}] speakText: Audio data collected, size: ${audioBlob.size} bytes`);
        
        // Reset the audio element for the fallback approach
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current.load();
        }
        
        audioRef.current = new Audio();
        setupAudioElementHandlers();
        
        // Create an object URL from the blob
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set the source after setup
        audioRef.current.src = audioUrl;
        
        // Add handler to clean up object URL
        const originalOnEnded = audioRef.current.onended;
        audioRef.current.onended = (event) => {
          URL.revokeObjectURL(audioUrl);
          if (originalOnEnded) {
            originalOnEnded.call(audioRef.current, event);
          }
        };
        
        // Small delay before attempting playback and make sure the audio is loaded
        await new Promise(resolve => {
          if (!audioRef.current) {
            resolve(null);
            return;
          }
          
          // Allow browser to prepare the audio
          audioRef.current.addEventListener('canplaythrough', () => {
            console.log(`[${Date.now()}] speakText: Audio is ready to play without buffering`);
            resolve(null);
          }, { once: true });
          
          // Fallback in case canplaythrough doesn't fire
          setTimeout(() => {
            console.log(`[${Date.now()}] speakText: Timed out waiting for canplaythrough event, attempting playback anyway`);
            resolve(null);
          }, 500);
        });
        
        // Play the audio
        console.log(`[${Date.now()}] speakText: Attempting to play audio (fallback)...`);
        await audioRef.current.play();
        console.log(`[${Date.now()}] speakText: Fallback audio playback started successfully!`);
        
        // After fallback playback starts, ensure recognition is active
        setTimeout(restartRecognitionDuringTTS, 200);
      }
    } catch (error) {
      console.error(`[${Date.now()}] speakText: Fatal error in speech synthesis:`, error);
      setIsSpeaking(false);
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
          style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}
        >
          <Textarea
            placeholder={
              micPermission === 'denied' 
                ? "Microphone access denied" 
                : isListening 
                  ? "Listening..." 
                  : "Ask AI anything..."
            }
            value={isListening ? transcript : input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isLoading || isListening}
            style={{ flex: 1 }}
            size="sm"
            autosize
            minRows={4}
            maxRows={10}
            onKeyDown={(e) => {
              // Send on Enter (without modifier keys)
              if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && (input.trim() || transcript.trim())) {
                  handleSubmit(e);
                }
              }
              // Allow new line on Cmd+Enter or Ctrl+Enter
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                const cursorPosition = e.currentTarget.selectionStart;
                const newValue = input.slice(0, cursorPosition) + '\n' + input.slice(cursorPosition);
                setInput(newValue);
                // Move cursor after the new line
                setTimeout(() => {
                  e.currentTarget.selectionStart = cursorPosition + 1;
                  e.currentTarget.selectionEnd = cursorPosition + 1;
                }, 0);
              }
            }}
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
              title={
                micPermission === 'denied'
                  ? "Microphone access denied"
                  : isListening 
                    ? "Stop listening" 
                    : "Start listening"
              }
              disabled={micPermission === 'denied'}
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
