// TTS Player
// This module will handle fetching TTS audio and playing it.

class TTSPlayer {
  private audioContext: AudioContext;
  private textToSpeakQueue: string[] = [];
  private audioPlaybackQueue: ArrayBuffer[] = [];

  private isFetchingFromApi = false;
  private isPlayingAudio = false;

  private currentSource: AudioBufferSourceNode | null = null;
  private isEnabled = false;
  private sentenceEndChars = [".", "?", "!", "\n"];
  private textBuffer = "";
  private onPlaybackComplete: (() => void) | null = null;

  constructor() {
    try {
      this.audioContext = new window.AudioContext();
    } catch (e) {
      console.error("Could not create AudioContext immediately:", e);
    }
  }

  private log(message: string) {
    const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
    console.log(`[TTS ${timestamp}] ${message}`);
  }

  public enable() {
    this.log(`Enabling TTS (was ${this.isEnabled ? "enabled" : "disabled"})`);
    this.isEnabled = true;
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext
        .resume()
        .then(() => this.log("AudioContext resumed"))
        .catch((err) => console.error("Error resuming AudioContext:", err));
    }
    // Process any text that might have been buffered while disabled or before enabling
    this.processBufferedText();
    // Start fetching if there's anything in the queue
    this.tryFetchNextTTS();
  }

  public disable() {
    this.log(`Disabling TTS (was ${this.isEnabled ? "enabled" : "disabled"})`);
    this.isEnabled = false;
    this.stop();
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public hasPendingAudio(): boolean {
    return (
      this.isPlayingAudio ||
      this.audioPlaybackQueue.length > 0 ||
      this.textToSpeakQueue.length > 0 ||
      this.isFetchingFromApi ||
      this.textBuffer.trim().length > 0
    );
  }

  public addText(textChunk: string) {
    if (!this.isEnabled || !textChunk) {
      if (!this.isEnabled) {
        this.log(`Ignoring text chunk because TTS disabled: "${textChunk}"`);
      }
      return;
    }
    this.log(`Adding text chunk: "${textChunk}"`);
    this.textBuffer += textChunk;
    this.processBufferedText();
  }

  private processBufferedText() {
    if (!this.isEnabled) return;

    // const lastProcessedIndex = -1; // This was unused, removed.
    for (let i = 0; i < this.textBuffer.length; i++) {
      if (this.sentenceEndChars.includes(this.textBuffer[i])) {
        const sentence = this.textBuffer.substring(0, i + 1).trim();
        if (sentence) {
          this.log(`Queuing sentence: "${sentence}"`);
          this.textToSpeakQueue.push(sentence);
          // No need to call tryFetchNextTTS here for every sentence,
          // addText calls processBufferedText which might add multiple sentences.
          // One call to tryFetchNextTTS after the loop (or from addText/enable) is sufficient.
        }
        this.textBuffer = this.textBuffer.substring(i + 1);
        i = -1;
      }
    }
    // After processing the current buffer, try to fetch if new sentences were added.
    this.tryFetchNextTTS();
  }

  public finalizeStream() {
    if (this.isEnabled && this.textBuffer.trim()) {
      const remainingText = this.textBuffer.trim();
      this.log(`Finalizing stream with remaining text: "${remainingText}"`);
      this.textBuffer = ""; // Clear buffer after taking remaining
      this.textToSpeakQueue.push(remainingText);
      this.tryFetchNextTTS();
    } else {
      this.log("Finalizing stream - no remaining text or TTS disabled");
    }
    // Consider if we need to ensure all existing fetches complete before resolving a promise here if finalizeStream were async.
    // For now, it just ensures any buffered text is queued.
  }

  private async tryFetchNextTTS(): Promise<void> {
    if (
      !this.isEnabled ||
      this.isFetchingFromApi ||
      this.textToSpeakQueue.length === 0
    ) {
      return;
    }

    this.isFetchingFromApi = true;
    const text = this.textToSpeakQueue.shift();

    if (!text) {
      // Should be guarded by length check, but for safety.
      this.isFetchingFromApi = false;
      // If queue was supposedly not empty but shift gave nothing, try again in case of race, though unlikely here.
      this.tryFetchNextTTS();
      return;
    }

    this.log(`Fetching TTS for: "${text}"`);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      // Check if disabled during await
      if (!this.isEnabled) {
        this.log("TTS disabled during fetch, aborting");
        this.isFetchingFromApi = false; // Ensure flag is cleared
        return;
      }

      if (!response.ok) {
        console.error(
          `TTS API request failed for "${text}":`,
          response.status,
          response.statusText,
        );
        this.isFetchingFromApi = false;
        this.tryFetchNextTTS(); // Try next item in queue
        return;
      }

      const audioData = await response.arrayBuffer();

      // Check if disabled during await response.arrayBuffer()
      if (!this.isEnabled) {
        this.log("TTS disabled during audio buffer processing, aborting");
        this.isFetchingFromApi = false;
        return;
      }

      this.log(
        `Audio data received, queuing for playback (${audioData.byteLength} bytes)`,
      );
      this.audioPlaybackQueue.push(audioData);
      this.isFetchingFromApi = false;
      this.tryPlayNextAudio();
      this.tryFetchNextTTS();
    } catch (error) {
      console.error(`Error fetching TTS audio for "${text}":`, error);
      // Check if disabled due to error or concurrently
      if (!this.isEnabled) {
        this.isFetchingFromApi = false;
        return;
      }
      this.isFetchingFromApi = false;
      this.tryFetchNextTTS();
    }
  }

  public setOnPlaybackComplete(callback: () => void) {
    this.onPlaybackComplete = callback;
  }

  private async tryPlayNextAudio(): Promise<void> {
    if (
      !this.isEnabled ||
      this.isPlayingAudio ||
      this.audioPlaybackQueue.length === 0 ||
      !this.audioContext
    ) {
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.log("AudioContext suspended, attempting to resume before playing");
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.error("Could not resume AudioContext, playback may fail:", err);
        return;
      }
    }

    this.isPlayingAudio = true;
    const audioData = this.audioPlaybackQueue.shift();

    if (!audioData) {
      this.isPlayingAudio = false;
      return;
    }

    try {
      this.log("Starting audio playback");
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      // Check if disabled during await
      if (!this.isEnabled) {
        this.log("TTS disabled during audio decode, stopping");
        this.isPlayingAudio = false; // Ensure flag is cleared
        // Audio is decoded but not played. It remains shifted from queue.
        // This is acceptable, as new enable() won't replay it.
        return;
      }
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);
      this.currentSource.start();

      this.currentSource.onended = () => {
        this.log("Audio playback ended");
        this.currentSource = null;
        this.isPlayingAudio = false;
        // Check if still enabled before playing next
        if (this.isEnabled) {
          this.tryPlayNextAudio();
        }
        // Trigger the playback complete callback if set
        if (this.onPlaybackComplete) {
          this.log("Triggering playback complete callback");
          this.onPlaybackComplete();
        }
      };
    } catch (error) {
      console.error("Error playing audio:", error);
      this.isPlayingAudio = false;
      // Check if still enabled
      if (this.isEnabled) {
        this.tryPlayNextAudio();
      }
    }
  }

  public stop(): void {
    this.log("Stop called - clearing queues and stopping playback");
    // isEnabled is set to false by disable() before calling stop().
    // Here we focus on cleanup.
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        console.warn("Error stopping current audio source:", e);
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.audioPlaybackQueue = [];
    this.textToSpeakQueue = [];
    this.isPlayingAudio = false;
    this.isFetchingFromApi = false;
    this.textBuffer = "";
  }
}

export const ttsPlayer = new TTSPlayer();
