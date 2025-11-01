/**
 * AeroAI Pro - Advanced Chat Application
 *
 * Features:
 * - Multiple chat sessions with localStorage
 * - Enhanced markdown (LaTeX, Mermaid, syntax highlighting)
 * - Debug mode with system override
 * - Chat management (rename, delete, export, import)
 * - Message actions (copy, delete, edit)
 * - Search & keyboard shortcuts
 * - Token counter
 *
 * @version 5.0.0
 */

// ============================================================================
// GLOBAL STATE
// ============================================================================

const state = {
  chats: new Map(),        // chatId -> { id, title, messages, created, updated }
  currentChatId: null,
  config: null,
  isGenerating: false,
  abortController: null,
  debugMode: false,
  debugOverride: "",
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  // Sidebar
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  newChatBtn: document.getElementById("new-chat-btn"),
  chatList: document.getElementById("chat-list"),
  searchChats: document.getElementById("search-chats"),
  exportAllBtn: document.getElementById("export-all-btn"),
  importChatsBtn: document.getElementById("import-chats-btn"),
  clearAllBtn: document.getElementById("clear-all-btn"),
  shortcutsBtn: document.getElementById("shortcuts-btn"),

  // Header
  chatTitle: document.getElementById("chat-title"),
  debugToggle: document.getElementById("debug-toggle"),
  exportChatBtn: document.getElementById("export-chat-btn"),

  // Provenance
  provenanceBanner: document.getElementById("provenance-banner"),
  modelName: document.getElementById("model-name"),

  // Debug
  debugPanel: document.getElementById("debug-panel"),
  debugOverride: document.getElementById("debug-override"),
  debugTokens: document.getElementById("debug-tokens"),
  debugMessages: document.getElementById("debug-messages"),
  debugSession: document.getElementById("debug-session"),
  debugModel: document.getElementById("debug-model"),

  // Toolbar
  modelSelect: document.getElementById("model-select"),
  systemMode: document.getElementById("system-mode"),
  tokenCounter: document.getElementById("token-counter"),
  regenerateBtn: document.getElementById("regenerate-btn"),
  stopBtn: document.getElementById("stop-btn"),
  clearBtn: document.getElementById("clear-btn"),

  // Chat
  messages: document.getElementById("messages"),
  typingIndicator: document.getElementById("typing-indicator"),
  composer: document.getElementById("composer"),
  prompt: document.getElementById("prompt"),
  send: document.getElementById("send"),

  // Modals
  renameModal: document.getElementById("rename-modal"),
  renameInput: document.getElementById("rename-input"),
  renameCancel: document.getElementById("rename-cancel"),
  renameConfirm: document.getElementById("rename-confirm"),
  importModal: document.getElementById("import-modal"),
  importTextarea: document.getElementById("import-textarea"),
  importCancel: document.getElementById("import-cancel"),
  importConfirm: document.getElementById("import-confirm"),

  // Shortcuts
  shortcutsHelp: document.getElementById("shortcuts-help"),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log("🚀 AeroAI Pro initializing...");

  // Initialize Mermaid
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
  }

  // Load config from backend
  await loadConfig();

  // Setup event listeners
  setupEventListeners();

  // Load chats from localStorage
  loadChats();

  // Create or load current chat
  if (state.chats.size === 0) {
    createNewChat();
  } else {
    // Load most recent chat
    const sortedChats = Array.from(state.chats.values()).sort((a, b) => b.updated - a.updated);
    switchToChat(sortedChats[0].id);
  }

  // Render chat list
  renderChatList();

  console.log("✓ AeroAI Pro ready");
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("Failed to load config");

    state.config = await response.json();

    // Populate model selector
    elements.modelSelect.innerHTML = state.config.models
      .map(m => `<option value="${m.id}">${m.name} (${m.tier})</option>`)
      .join("");

    // Update provenance
    const provenance = state.config.provenance;
    elements.modelName.textContent = provenance.model.split('/').pop() || provenance.model;

    console.log("✓ Config loaded:", state.config);
  } catch (error) {
    console.error("Failed to load config:", error);
    showNotification("Failed to connect to Aero. Please refresh.", "error");
  }
}

function setupEventListeners() {
  // Sidebar
  elements.sidebarToggle.addEventListener("click", toggleSidebar);
  elements.newChatBtn.addEventListener("click", createNewChat);
  elements.searchChats.addEventListener("input", handleSearch);
  elements.exportAllBtn.addEventListener("click", exportAllChats);
  elements.importChatsBtn.addEventListener("click", () => showModal("import"));
  elements.clearAllBtn.addEventListener("click", clearAllChats);
  elements.shortcutsBtn.addEventListener("click", toggleShortcutsHelp);

  // Header
  elements.chatTitle.addEventListener("blur", saveChatTitle);
  elements.chatTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      elements.chatTitle.blur();
    }
  });
  elements.debugToggle.addEventListener("click", toggleDebugMode);
  elements.exportChatBtn.addEventListener("click", exportCurrentChat);

  // Debug
  elements.debugOverride.addEventListener("input", (e) => {
    state.debugOverride = e.target.value;
  });

  // Toolbar
  elements.regenerateBtn.addEventListener("click", handleRegenerate);
  elements.stopBtn.addEventListener("click", handleStop);
  elements.clearBtn.addEventListener("click", clearCurrentChat);

  // Composer
  elements.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend();
  });

  elements.prompt.addEventListener("input", () => {
    elements.prompt.style.height = "auto";
    elements.prompt.style.height = `${elements.prompt.scrollHeight}px`;
    updateTokenCount();
  });

  elements.prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Modals
  elements.renameCancel.addEventListener("click", () => hideModal("rename"));
  elements.renameConfirm.addEventListener("click", confirmRename);
  elements.importCancel.addEventListener("click", () => hideModal("import"));
  elements.importConfirm.addEventListener("click", confirmImport);

  // Click outside modal to close
  elements.renameModal.addEventListener("click", (e) => {
    if (e.target === elements.renameModal) hideModal("rename");
  });
  elements.importModal.addEventListener("click", (e) => {
    if (e.target === elements.importModal) hideModal("import");
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcut);
}

// ============================================================================
// CHAT MANAGEMENT
// ============================================================================

function createNewChat() {
  const chat = {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: "New Chat",
    messages: [],
    created: Date.now(),
    updated: Date.now(),
    sessionId: generateSessionId(),
  };

  state.chats.set(chat.id, chat);
  switchToChat(chat.id);
  saveChats();
  renderChatList();

  // Add welcome message
  addWelcomeMessage();
}

function switchToChat(chatId) {
  if (!state.chats.has(chatId)) return;

  state.currentChatId = chatId;
  const chat = getCurrentChat();

  // Update title
  elements.chatTitle.value = chat.title;

  // Clear and render messages
  elements.messages.innerHTML = "";
  chat.messages.forEach(msg => {
    addMessageToDOM(msg.role, msg.content, msg.id, false);
  });

  // Update UI
  renderChatList();
  updateDebugStats();
  updateTokenCount();

  // Enable/disable regenerate
  const lastMessage = chat.messages[chat.messages.length - 1];
  elements.regenerateBtn.disabled = !lastMessage || lastMessage.role !== "assistant";

  // Focus input
  elements.prompt.focus();
}

function getCurrentChat() {
  return state.chats.get(state.currentChatId);
}

function deleteChat(chatId) {
  if (!confirm("Delete this chat? This cannot be undone.")) return;

  state.chats.delete(chatId);

  // If deleting current chat, switch to another or create new
  if (chatId === state.currentChatId) {
    if (state.chats.size > 0) {
      const firstChat = Array.from(state.chats.values())[0];
      switchToChat(firstChat.id);
    } else {
      createNewChat();
    }
  }

  saveChats();
  renderChatList();
}

function saveChatTitle() {
  const chat = getCurrentChat();
  if (!chat) return;

  chat.title = elements.chatTitle.value.trim() || "New Chat";
  chat.updated = Date.now();
  saveChats();
  renderChatList();
}

function clearCurrentChat() {
  if (!confirm("Clear all messages? This cannot be undone.")) return;

  const chat = getCurrentChat();
  if (!chat) return;

  chat.messages = [];
  chat.updated = Date.now();

  elements.messages.innerHTML = "";
  saveChats();
  addWelcomeMessage();
  updateTokenCount();
}

function clearAllChats() {
  if (!confirm("Delete ALL chats? This cannot be undone and will clear all localStorage data.")) return;

  state.chats.clear();
  createNewChat();
  saveChats();
  renderChatList();
}

// ============================================================================
// CHAT LIST RENDERING
// ============================================================================

function renderChatList() {
  const searchTerm = elements.searchChats.value.toLowerCase();
  const sortedChats = Array.from(state.chats.values())
    .sort((a, b) => b.updated - a.updated);

  elements.chatList.innerHTML = sortedChats
    .filter(chat => {
      if (!searchTerm) return true;
      return chat.title.toLowerCase().includes(searchTerm) ||
             chat.messages.some(m => m.content.toLowerCase().includes(searchTerm));
    })
    .map(chat => createChatItem(chat))
    .join("");
}

function createChatItem(chat) {
  const isActive = chat.id === state.currentChatId;
  const preview = chat.messages.length > 0
    ? chat.messages[chat.messages.length - 1].content.substring(0, 60)
    : "No messages yet";

  return `
    <div class="chat-item ${isActive ? 'active' : ''}" onclick="switchToChat('${chat.id}')">
      <div class="chat-item-content">
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
        <div class="chat-item-preview">${escapeHtml(preview)}...</div>
      </div>
      <div class="chat-item-actions">
        <button class="chat-item-btn" onclick="event.stopPropagation(); renameChat('${chat.id}')" title="Rename">✏️</button>
        <button class="chat-item-btn" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function renameChat(chatId) {
  state.renamingChatId = chatId;
  const chat = state.chats.get(chatId);
  elements.renameInput.value = chat.title;
  showModal("rename");
  elements.renameInput.focus();
  elements.renameInput.select();
}

function confirmRename() {
  const chat = state.chats.get(state.renamingChatId);
  if (!chat) return;

  chat.title = elements.renameInput.value.trim() || "New Chat";
  chat.updated = Date.now();

  if (state.renamingChatId === state.currentChatId) {
    elements.chatTitle.value = chat.title;
  }

  saveChats();
  renderChatList();
  hideModal("rename");
}

// ============================================================================
// MESSAGING
// ============================================================================

async function handleSend() {
  const message = elements.prompt.value.trim();
  if (!message || state.isGenerating) return;

  const chat = getCurrentChat();
  if (!chat) return;

  // Add user message
  const userMsgId = addMessage("user", message);

  // Clear input
  elements.prompt.value = "";
  elements.prompt.style.height = "auto";

  // Update chat
  chat.updated = Date.now();
  saveChats();

  // Send to API
  await sendMessage();
}

function addMessage(role, content, save = true) {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (save) {
    const chat = getCurrentChat();
    if (!chat) return;

    chat.messages.push({ id: msgId, role, content, timestamp: Date.now() });
    saveChats();
  }

  addMessageToDOM(role, content, msgId, save);
  updateTokenCount();

  return msgId;
}

function addWelcomeMessage() {
  addMessage("assistant", "👋 Hey there! I'm **Aero Pro** — small, speedy, and now with enhanced markdown, multiple chats, and debug tools. What can I help you with today?");
}

function addMessageToDOM(role, content, msgId, animate = true) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper";
  wrapper.dataset.id = msgId;

  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.innerHTML = renderMarkdown(content);

  wrapper.appendChild(message);

  // Add message actions
  if (role !== "system") {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    actions.innerHTML = `
      <button class="message-btn" onclick="copyMessage('${msgId}')" title="Copy">📋</button>
      <button class="message-btn" onclick="deleteMessage('${msgId}')" title="Delete">🗑️</button>
      ${role === "assistant" ? `<button class="message-btn" onclick="regenerateMessage('${msgId}')" title="Regenerate">🔄</button>` : ''}
    `;
    wrapper.appendChild(actions);
  }

  elements.messages.appendChild(wrapper);
  scrollToBottom();

  // Render Mermaid diagrams
  if (window.mermaid) {
    mermaid.run({ querySelector: '.mermaid' });
  }
}

function updateMessageContent(msgId, content) {
  const wrapper = document.querySelector(`[data-id="${msgId}"]`);
  if (!wrapper) return;

  const message = wrapper.querySelector(".message");
  message.innerHTML = renderMarkdown(content);

  // Re-render Mermaid
  if (window.mermaid) {
    mermaid.run({ querySelector: '.mermaid' });
  }

  scrollToBottom();
}

async function sendMessage() {
  setGeneratingState(true);
  elements.typingIndicator.classList.add("visible");

  const chat = getCurrentChat();
  if (!chat) return;

  // Create abort controller
  state.abortController = new AbortController();

  // Prepare request
  const requestBody = {
    session_id: chat.sessionId,
    messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
    model: elements.modelSelect.value || undefined,
    system_mode: elements.systemMode.value,
  };

  // Debug mode override
  if (state.debugMode && state.debugOverride.trim()) {
    requestBody.messages = requestBody.messages.filter(m => m.role !== "system");
    requestBody.messages.unshift({ role: "system", content: state.debugOverride.trim() });
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      handleAPIError(response.status, errorData);
      return;
    }

    // Handle streaming
    await handleStreamingResponse(response);

  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Request aborted");
      showNotification("Generation stopped", "info");
    } else {
      console.error("Send error:", error);
      showNotification("Oops — Aero ran out of breath. Try again in a moment.", "error");
    }
  } finally {
    elements.typingIndicator.classList.remove("visible");
    setGeneratingState(false);
    state.abortController = null;
  }
}

async function handleStreamingResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Create assistant message
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chat = getCurrentChat();

  chat.messages.push({ id: msgId, role: "assistant", content: "", timestamp: Date.now() });
  addMessageToDOM("assistant", "", msgId);

  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.response) {
          fullContent += data.response;

          // Update message in state
          const msg = chat.messages.find(m => m.id === msgId);
          if (msg) msg.content = fullContent;

          // Update DOM
          updateMessageContent(msgId, fullContent);
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          console.error("Stream parsing error:", e);
        }
      }
    }
  }

  // Save and update UI
  chat.updated = Date.now();
  saveChats();
  elements.regenerateBtn.disabled = false;
  updateDebugStats();
}

function handleAPIError(status, errorData) {
  const { error, message, retry_after } = errorData;

  if (status === 429) {
    const retryMsg = retry_after ? ` Try again in ${retry_after}s.` : "";
    showNotification(`Aero's on a coffee break.${retryMsg}`, "warning");
  } else {
    showNotification(message || "Oops — something went wrong.", "error");
  }
}

// ============================================================================
// MESSAGE ACTIONS
// ============================================================================

async function handleRegenerate() {
  const chat = getCurrentChat();
  if (!chat || chat.messages.length === 0) return;

  // Remove last assistant message
  const lastMsg = chat.messages[chat.messages.length - 1];
  if (lastMsg.role !== "assistant") return;

  chat.messages.pop();

  // Remove from DOM
  const wrapper = document.querySelector(`[data-id="${lastMsg.id}"]`);
  if (wrapper) wrapper.remove();

  saveChats();

  // Resend
  await sendMessage();
}

function handleStop() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

function copyMessage(msgId) {
  const chat = getCurrentChat();
  const msg = chat.messages.find(m => m.id === msgId);
  if (!msg) return;

  navigator.clipboard.writeText(msg.content).then(() => {
    showNotification("Copied to clipboard", "success");
  }).catch(err => {
    console.error("Failed to copy:", err);
  });
}

function deleteMessage(msgId) {
  if (!confirm("Delete this message?")) return;

  const chat = getCurrentChat();
  chat.messages = chat.messages.filter(m => m.id !== msgId);

  const wrapper = document.querySelector(`[data-id="${msgId}"]`);
  if (wrapper) wrapper.remove();

  saveChats();
  updateTokenCount();
}

function regenerateMessage(msgId) {
  // Find message index and regenerate from there
  const chat = getCurrentChat();
  const msgIndex = chat.messages.findIndex(m => m.id === msgId);
  if (msgIndex === -1) return;

  // Remove this message and all after it
  chat.messages = chat.messages.slice(0, msgIndex);

  // Remove from DOM
  document.querySelectorAll(".message-wrapper").forEach((wrapper, idx) => {
    if (idx >= msgIndex) wrapper.remove();
  });

  saveChats();

  // Resend
  sendMessage();
}

// ============================================================================
// MARKDOWN RENDERING (Enhanced)
// ============================================================================

function renderMarkdown(content) {
  // Configure marked
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.error(err);
        }
      }
      return code;
    },
    breaks: true,
    gfm: true,
  });

  let html = marked.parse(content);

  // LaTeX rendering
  html = renderLaTeX(html);

  // Mermaid diagrams
  html = renderMermaid(html);

  // Add copy buttons to code blocks
  html = addCopyButtonsToHTML(html);

  return html;
}

function renderLaTeX(html) {
  // Inline math: $...$
  html = html.replace(/\$([^\$]+)\$/g, (match, tex) => {
    try {
      return katex.renderToString(tex, { throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  // Block math: $$...$$
  html = html.replace(/\$\$([^\$]+)\$\$/g, (match, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  return html;
}

function renderMermaid(html) {
  // Replace mermaid code blocks with div.mermaid
  html = html.replace(/<pre><code class="language-mermaid">([^<]+)<\/code><\/pre>/g, (match, code) => {
    return `<div class="mermaid">${code}</div>`;
  });

  return html;
}

function addCopyButtonsToHTML(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("pre code").forEach(code => {
    const pre = code.parentElement;
    if (!pre.querySelector(".copy-btn")) {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.onclick = async () => {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 2000);
      };
      pre.style.position = "relative";
      pre.appendChild(btn);
    }
  });

  return temp.innerHTML;
}

// ============================================================================
// DEBUG MODE
// ============================================================================

function toggleDebugMode() {
  state.debugMode = !state.debugMode;
  elements.debugPanel.classList.toggle("visible", state.debugMode);
  elements.debugToggle.classList.toggle("active", state.debugMode);

  if (state.debugMode) {
    updateDebugStats();
  }
}

function updateDebugStats() {
  if (!state.debugMode) return;

  const chat = getCurrentChat();
  if (!chat) return;

  const tokens = estimateTokens(chat.messages);

  elements.debugTokens.textContent = tokens;
  elements.debugMessages.textContent = chat.messages.length;
  elements.debugSession.textContent = chat.sessionId.substring(0, 16) + "...";
  elements.debugModel.textContent = elements.modelSelect.value || "default";
}

function estimateTokens(messages) {
  // Rough estimate: ~4 chars per token
  return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
}

// ============================================================================
// TOKEN COUNTER
// ============================================================================

function updateTokenCount() {
  const chat = getCurrentChat();
  if (!chat) return;

  const currentInput = elements.prompt.value;
  const totalContent = chat.messages.reduce((sum, m) => sum + m.content.length, 0) + currentInput.length;
  const tokens = Math.ceil(totalContent / 4);

  elements.tokenCounter.textContent = `Tokens: ${tokens}`;

  // Update debug if active
  if (state.debugMode) {
    updateDebugStats();
  }
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

function exportCurrentChat() {
  const chat = getCurrentChat();
  if (!chat) return;

  const exportData = {
    version: "5.0",
    exported: new Date().toISOString(),
    chats: [chat],
  };

  downloadJSON(exportData, `aero-chat-${chat.title.replace(/\s+/g, "-")}.json`);
  showNotification("Chat exported successfully", "success");
}

function exportAllChats() {
  const exportData = {
    version: "5.0",
    exported: new Date().toISOString(),
    chats: Array.from(state.chats.values()),
  };

  downloadJSON(exportData, `aero-all-chats-${Date.now()}.json`);
  showNotification("All chats exported successfully", "success");
}

function confirmImport() {
  try {
    const jsonData = JSON.parse(elements.importTextarea.value);

    if (!jsonData.chats || !Array.isArray(jsonData.chats)) {
      throw new Error("Invalid format");
    }

    // Import chats
    jsonData.chats.forEach(chat => {
      // Generate new ID to avoid conflicts
      chat.id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      chat.imported = Date.now();
      state.chats.set(chat.id, chat);
    });

    saveChats();
    renderChatList();
    hideModal("import");
    showNotification(`Imported ${jsonData.chats.length} chat(s)`, "success");

  } catch (error) {
    console.error("Import error:", error);
    showNotification("Invalid JSON format", "error");
  }
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// SEARCH
// ============================================================================

function handleSearch() {
  renderChatList();
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

function handleKeyboardShortcut(e) {
  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+N: New Chat
  if (ctrl && e.key === "n") {
    e.preventDefault();
    createNewChat();
  }

  // Ctrl+K: Search
  if (ctrl && e.key === "k") {
    e.preventDefault();
    elements.searchChats.focus();
    elements.searchChats.select();
  }

  // Ctrl+B: Toggle Sidebar
  if (ctrl && e.key === "b") {
    e.preventDefault();
    toggleSidebar();
  }

  // Ctrl+D: Debug Mode
  if (ctrl && e.key === "d") {
    e.preventDefault();
    toggleDebugMode();
  }

  // Ctrl+E: Export
  if (ctrl && e.key === "e") {
    e.preventDefault();
    exportCurrentChat();
  }

  // Ctrl+L: Clear Chat
  if (ctrl && e.key === "l") {
    e.preventDefault();
    clearCurrentChat();
  }

  // Escape: Focus Input
  if (e.key === "Escape") {
    elements.prompt.focus();
    hideModal("rename");
    hideModal("import");
    elements.shortcutsHelp.classList.remove("visible");
  }
}

function toggleShortcutsHelp() {
  elements.shortcutsHelp.classList.toggle("visible");
}

// ============================================================================
// UI HELPERS
// ============================================================================

function toggleSidebar() {
  elements.sidebar.classList.toggle("collapsed");
}

function setGeneratingState(generating) {
  state.isGenerating = generating;
  elements.prompt.disabled = generating;
  elements.send.disabled = generating;
  elements.stopBtn.disabled = !generating;
  elements.regenerateBtn.disabled = generating;

  if (!generating) {
    elements.prompt.focus();
  }
}

function showModal(type) {
  if (type === "rename") {
    elements.renameModal.classList.add("visible");
  } else if (type === "import") {
    elements.importModal.classList.add("visible");
  }
}

function hideModal(type) {
  if (type === "rename") {
    elements.renameModal.classList.remove("visible");
  } else if (type === "import") {
    elements.importModal.classList.remove("visible");
    elements.importTextarea.value = "";
  }
}

function showNotification(message, type = "info") {
  // Simple console notification for now
  // Could be enhanced with toast notifications
  const icon = type === "success" ? "✓" : type === "error" ? "✗" : "ℹ";
  console.log(`${icon} ${message}`);

  // You could add a toast notification here
}

function scrollToBottom() {
  elements.messages.scrollTo({
    top: elements.messages.scrollHeight,
    behavior: "smooth"
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

function saveChats() {
  try {
    const chatsArray = Array.from(state.chats.values());
    localStorage.setItem("aero_pro_chats", JSON.stringify(chatsArray));
  } catch (error) {
    console.error("Failed to save chats:", error);
  }
}

function loadChats() {
  try {
    const stored = localStorage.getItem("aero_pro_chats");
    if (!stored) return;

    const chatsArray = JSON.parse(stored);
    state.chats = new Map(chatsArray.map(chat => [chat.id, chat]));

    console.log(`✓ Loaded ${state.chats.size} chat(s) from storage`);
  } catch (error) {
    console.error("Failed to load chats:", error);
  }
}

// ============================================================================
// INITIALIZE
// ============================================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Make functions available globally for onclick handlers
window.switchToChat = switchToChat;
window.deleteChat = deleteChat;
window.renameChat = renameChat;
window.copyMessage = copyMessage;
window.deleteMessage = deleteMessage;
window.regenerateMessage = regenerateMessage;
