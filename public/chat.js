/**
 * AeroAI Chat App Frontend – Updated
 *
 * Supports:
 * - ChunkAugment 2.0 (chunked streaming)
 * - Tutor mode
 * - Markdown + code blocks (MD+)
 * - Blacklink terminology awareness
 * - TTS support
 * - Accessibility-friendly scrolling
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const tutorModeCheckbox = document.getElementById("tutor-mode"); // from settings
const ttsToggle = document.getElementById("tts-toggle"); // from settings
const chunkSizeInput = document.getElementById("chunk-size");

// Chat state
let chatHistory = [
  { role: "aero", content: "👋 Hello! I'm **Aero**, your Blacklink AI assistant. How can I help you today?" }
];
let isProcessing = false;
let tutorMode = false;
let chunkSize = parseInt(chunkSizeInput?.value || 1000, 10);
let ttsEnabled = false;

// Auto-resize textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

// Update settings
tutorModeCheckbox?.addEventListener("change", () => tutorMode = tutorModeCheckbox.checked);
chunkSizeInput?.addEventListener("change", () => chunkSize = parseInt(chunkSizeInput.value, 10));
ttsToggle?.addEventListener("change", () => ttsEnabled = ttsToggle.checked);

// Send message on Enter
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Send button
sendButton.addEventListener("click", sendMessage);

/**
 * Adds message to chat (MD+ + TTS)
 */
function addMessageToChat(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  messageEl.innerHTML = marked.parse(content); // MD+ support

  // Copy buttons for code blocks
  messageEl.querySelectorAll("pre").forEach(pre => {
    if (!pre.querySelector(".copy-btn")) {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.onclick = () => navigator.clipboard.writeText(pre.textContent);
      pre.appendChild(btn);
    }
  });

  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // TTS support
  if (role === "aero" && ttsEnabled) {
    const utterance = new SpeechSynthesisUtterance(messageEl.textContent);
    speechSynthesis.speak(utterance);
  }
}

/**
 * Sends a message using ChunkAugment 2.0
 */
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isProcessing) return;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // Add user message
  addMessageToChat("user", message);
  chatHistory.push({ role: "user", content: message });
  userInput.value = "";
  userInput.style.height = "auto";

  typingIndicator.classList.add("visible");

  try {
    // Create Aero message element
    const aeroMessageEl = document.createElement("div");
    aeroMessageEl.className = "message aero-message";
    aeroMessageEl.innerHTML = "<p></p>";
    chatMessages.appendChild(aeroMessageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Prepare message chunks
    const chunks = [];
    for (let i = 0; i < message.length; i += chunkSize) {
      chunks.push(message.slice(i, i + chunkSize));
    }

    // Include last few Aero messages for context (ChunkAugment)
    const contextChunks = chatHistory.filter(m => m.role === "aero").slice(-3).map(m => m.content);

    // Send request to backend API with tutor mode flag
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory,
        tutorMode,
        chunkSize,
        contextChunks
      }),
    });

    if (!response.ok) throw new Error("Failed to get response");

    // Streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE/JSON lines
      const lines = chunk.split("\n");
      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          if (jsonData.response) {
            fullResponse += jsonData.response;
            aeroMessageEl.querySelector("p").innerHTML = marked.parse(fullResponse);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (ttsEnabled) {
              const utterance = new SpeechSynthesisUtterance(jsonData.response);
              speechSynthesis.speak(utterance);
            }
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
        }
      }
    }

    chatHistory.push({ role: "aero", content: fullResponse });

  } catch (err) {
    console.error(err);
    addMessageToChat("aero", "⚠️ Oops! Aero couldn't process that request. Try again?");
  } finally {
    typingIndicator.classList.remove("visible");
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}
