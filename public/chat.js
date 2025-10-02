/**
 * AeroAI Chat App Frontend - Enhanced
 * 
 * Features:
 * - ChunkAugment 2.0: Intelligent chunked message processing
 * - Tutor Mode: Educational context awareness
 * - MD+ Support: Markdown with code blocks and syntax highlighting
 * - Blacklink Terminology: Context-aware responses
 * - TTS: Text-to-speech with queue management
 * - Accessibility: ARIA labels and keyboard navigation
 * 
 * @author Blacklink Labs
 * @version 2.1.0
 */

// ========================================
// DOM Elements
// ========================================
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const tutorModeCheckbox = document.getElementById("tutor-mode");
const ttsToggle = document.getElementById("tts-toggle");
const chunkSizeInput = document.getElementById("chunk-size");

// ========================================
// Application State
// ========================================
const state = {
  chatHistory: [
    {
      role: "aero",
      content: "👋 Hello! I'm **Aero**, your Blacklink AI assistant. How can I help you today?",
      timestamp: Date.now()
    }
  ],
  isProcessing: false,
  tutorMode: false,
  chunkSize: 1000,
  ttsEnabled: false,
  ttsQueue: [],
  currentUtterance: null
};

// ========================================
// Configuration
// ========================================
const config = {
  api: {
    endpoint: "/api/chat",
    timeout: 30000,
    retryAttempts: 3
  },
  chunkAugment: {
    contextWindow: 3, // Number of previous Aero messages to include
    minChunkSize: 100,
    maxChunkSize: 5000
  },
  tts: {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null // Will use default or user preference
  }
};

// ========================================
// Initialization
// ========================================
function init() {
  setupEventListeners();
  loadUserPreferences();
  displayWelcomeMessage();

  // Focus input on load
  userInput.focus();
}

function setupEventListeners() {
  // Input auto-resize
  userInput.addEventListener("input", handleInputResize);

  // Send message handlers
  userInput.addEventListener("keydown", handleKeyPress);
  sendButton.addEventListener("click", handleSendClick);

  // Settings handlers
  if (tutorModeCheckbox) {
    tutorModeCheckbox.addEventListener("change", () => {
      state.tutorMode = tutorModeCheckbox.checked;
      saveUserPreferences();
    });
  }

  if (chunkSizeInput) {
    chunkSizeInput.addEventListener("change", () => {
      const newSize = parseInt(chunkSizeInput.value, 10);
      if (newSize >= config.chunkAugment.minChunkSize &&
        newSize <= config.chunkAugment.maxChunkSize) {
        state.chunkSize = newSize;
        saveUserPreferences();
      }
    });
  }

  if (ttsToggle) {
    ttsToggle.addEventListener("change", () => {
      state.ttsEnabled = ttsToggle.checked;
      if (!state.ttsEnabled) {
        stopTTS();
      }
      saveUserPreferences();
    });
  }
}

// ========================================
// Input Handlers
// ========================================
function handleInputResize() {
  userInput.style.height = "auto";
  userInput.style.height = `${userInput.scrollHeight}px`;
}

function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function handleSendClick() {
  sendMessage();
}

// ========================================
// Message Management
// ========================================
function addMessageToChat(role, content, streaming = false) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  messageEl.setAttribute("role", "article");
  messageEl.setAttribute("aria-label", `${role} message`);

  // Parse markdown
  messageEl.innerHTML = marked.parse(content);

  // Add copy buttons to code blocks
  addCopyButtons(messageEl);

  chatMessages.appendChild(messageEl);
  scrollToBottom();

  // Handle TTS for Aero messages
  if (role === "aero" && state.ttsEnabled && !streaming) {
    queueTTS(content);
  }

  return messageEl;
}

function updateMessageContent(messageEl, content) {
  messageEl.innerHTML = marked.parse(content);
  addCopyButtons(messageEl);
  scrollToBottom();
}

function addCopyButtons(containerEl) {
  containerEl.querySelectorAll("pre").forEach(pre => {
    // Skip if copy button already exists
    if (pre.querySelector(".copy-btn")) return;

    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");

    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent);
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        btn.textContent = "Failed";
        setTimeout(() => btn.textContent = "Copy", 2000);
      }
    };

    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

function scrollToBottom(smooth = true) {
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: smooth ? "smooth" : "auto"
  });
}

function displayWelcomeMessage() {
  if (state.chatHistory.length > 0) {
    addMessageToChat("aero", state.chatHistory[0].content);
  }
}

// ========================================
// ChunkAugment 2.0 Processing
// ========================================
function prepareChunkAugmentData(message) {
  // Split message into chunks
  const chunks = [];
  for (let i = 0; i < message.length; i += state.chunkSize) {
    chunks.push(message.slice(i, i + state.chunkSize));
  }

  // Extract context from recent Aero messages
  const contextChunks = state.chatHistory
    .filter(m => m.role === "aero")
    .slice(-config.chunkAugment.contextWindow)
    .map(m => m.content);

  return {
    chunks,
    contextChunks,
    metadata: {
      totalChunks: chunks.length,
      chunkSize: state.chunkSize,
      contextWindow: config.chunkAugment.contextWindow
    }
  };
}

// ========================================
// API Communication
// ========================================
async function sendMessage() {
  const message = userInput.value.trim();

  // Validation
  if (!message || state.isProcessing) return;

  // Update UI state
  setProcessingState(true);

  // Add user message to chat
  addMessageToChat("user", message);
  state.chatHistory.push({
    role: "user",
    content: message,
    timestamp: Date.now()
  });

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // Show typing indicator
  typingIndicator.classList.add("visible");

  try {
    // Prepare ChunkAugment data
    const chunkData = prepareChunkAugmentData(message);

    // Create streaming message element
    const aeroMessageEl = document.createElement("div");
    aeroMessageEl.className = "message aero-message";
    aeroMessageEl.innerHTML = "<p></p>";
    aeroMessageEl.setAttribute("role", "article");
    aeroMessageEl.setAttribute("aria-label", "Aero message");
    aeroMessageEl.setAttribute("aria-live", "polite");
    chatMessages.appendChild(aeroMessageEl);
    scrollToBottom(false);

    // Send request with retry logic
    const response = await fetchWithRetry(config.api.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.chatHistory,
        tutorMode: state.tutorMode,
        chunkSize: state.chunkSize,
        contextChunks: chunkData.contextChunks,
        chunkMetadata: chunkData.metadata
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    // Handle streaming response
    await handleStreamingResponse(response, aeroMessageEl);

  } catch (err) {
    console.error("Error sending message:", err);
    handleError(err);
  } finally {
    typingIndicator.classList.remove("visible");
    setProcessingState(false);
  }
}

async function handleStreamingResponse(response, messageEl) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    // Keep the last incomplete line in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const jsonData = JSON.parse(line);

        if (jsonData.response) {
          fullResponse += jsonData.response;
          updateMessageContent(messageEl, fullResponse);

          // Stream TTS if enabled
          if (state.ttsEnabled) {
            speakText(jsonData.response);
          }
        }

        if (jsonData.error) {
          throw new Error(jsonData.error);
        }

      } catch (e) {
        if (e instanceof SyntaxError) {
          console.warn("Failed to parse JSON line:", line);
        } else {
          throw e;
        }
      }
    }
  }

  // Add final response to history
  state.chatHistory.push({
    role: "aero",
    content: fullResponse,
    timestamp: Date.now()
  });
}

async function fetchWithRetry(url, options, attempt = 1) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;

  } catch (err) {
    if (attempt < config.api.retryAttempts) {
      console.warn(`Request failed (attempt ${attempt}), retrying...`);
      await sleep(1000 * attempt); // Exponential backoff
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw err;
  }
}

// ========================================
// Text-to-Speech
// ========================================
function queueTTS(text) {
  state.ttsQueue.push(text);
  if (!state.currentUtterance) {
    processTTSQueue();
  }
}

function processTTSQueue() {
  if (state.ttsQueue.length === 0) {
    state.currentUtterance = null;
    return;
  }

  const text = state.ttsQueue.shift();
  speakText(text);
}

function speakText(text) {
  if (!state.ttsEnabled) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = config.tts.rate;
  utterance.pitch = config.tts.pitch;
  utterance.volume = config.tts.volume;

  if (config.tts.voice) {
    utterance.voice = config.tts.voice;
  }

  utterance.onend = () => {
    processTTSQueue();
  };

  utterance.onerror = (err) => {
    console.error("TTS error:", err);
    processTTSQueue();
  };

  state.currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

function stopTTS() {
  speechSynthesis.cancel();
  state.ttsQueue = [];
  state.currentUtterance = null;
}

// ========================================
// UI State Management
// ========================================
function setProcessingState(processing) {
  state.isProcessing = processing;
  userInput.disabled = processing;
  sendButton.disabled = processing;

  if (!processing) {
    userInput.focus();
  }
}

function handleError(error) {
  const errorMessage = error.message || "An unexpected error occurred";
  addMessageToChat("aero", `⚠️ **Error**: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`);
}

// ========================================
// Persistence
// ========================================
function saveUserPreferences() {
  const preferences = {
    tutorMode: state.tutorMode,
    chunkSize: state.chunkSize,
    ttsEnabled: state.ttsEnabled
  };

  try {
    // Store in memory for session
    window.aeroPreferences = preferences;
  } catch (err) {
    console.warn("Failed to save preferences:", err);
  }
}

function loadUserPreferences() {
  try {
    const preferences = window.aeroPreferences || {};

    if (preferences.tutorMode !== undefined) {
      state.tutorMode = preferences.tutorMode;
      if (tutorModeCheckbox) tutorModeCheckbox.checked = state.tutorMode;
    }

    if (preferences.chunkSize !== undefined) {
      state.chunkSize = preferences.chunkSize;
      if (chunkSizeInput) chunkSizeInput.value = state.chunkSize;
    }

    if (preferences.ttsEnabled !== undefined) {
      state.ttsEnabled = preferences.ttsEnabled;
      if (ttsToggle) ttsToggle.checked = state.ttsEnabled;
    }
  } catch (err) {
    console.warn("Failed to load preferences:", err);
  }
}

// ========================================
// Utilities
// ========================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Initialize App
// ========================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for testing/debugging
if (typeof module !== "undefined" && module.exports) {
  module.exports = { state, config, sendMessage, addMessageToChat };
}