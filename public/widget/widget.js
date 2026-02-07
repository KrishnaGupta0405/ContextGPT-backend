(function () {
  "use strict";

  const CHATBOT_ID = "${chatbotId}";
  const API_BASE_URL = '${process.env.API_BASE_URL || "http://localhost:8000"}';
  const WIDGET_VERSION = '${config?.widgetVersion || "v1"}';

  const CONFIG = {
    chatbot: {} /* [[CHATBOT_DATA]] */,
    appearance: {} /* [[APPEARANCE_DATA]] */,
    behavior: {} /* [[BEHAVIOR_DATA]] */,
  };

  // Session ID
  function generateSessionId() {
    return "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  let sessionId = sessionStorage.getItem("chatbot_session_" + CHATBOT_ID);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem("chatbot_session_" + CHATBOT_ID, sessionId);
  }

  // Track session (fire and forget)
  fetch(API_BASE_URL + "/api/widget/" + CHATBOT_ID + "/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      originDomain: window.location.hostname,
      metadata: {
        url: window.location.href,
        referrer: document.referrer,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      },
    }),
  }).catch((err) => console.error("Track failed:", err));

  // CSS Injection
  const style = document.createElement("style");
  style.textContent = `/* [[STYLE_DATA]] */`;
  document.head.appendChild(style);
  document.head.appendChild(style);

  // HTML structure
  const widgetHTML = `
<div id="contextgpt-widget-container">
  <button id="contextgpt-chat-button" aria-label="Open chat">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </svg>
  </button>

  <div id="contextgpt-chat-window">
    <div id="contextgpt-chat-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <div id="contextgpt-chat-avatar" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-weight:bold;">
          ${(CONFIG.chatbot.name || "Bot")[0].toUpperCase()}
        </div>
        <div>
          <div id="contextgpt-chat-title">${CONFIG.chatbot.name || "Chat Support"}</div>
          <div style="font-size:12px;opacity:0.9;">Online</div>
        </div>
      </div>
      <button id="contextgpt-close-button" aria-label="Close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;">×</button>
    </div>

    <div id="contextgpt-chat-messages">
      <div style="background:#fff;padding:16px;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="margin:0 0 8px;">${CONFIG.appearance.welcomeMessage || "Welcome! 👋"}</h3>
        <p style="margin:0;color:#555;">How can we help you today?</p>
      </div>
    </div>

    <div class="contextgpt-typing-indicator" style="display:none;padding:16px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--brand-color,#0066ff);color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;">
          ${(CONFIG.chatbot.name || "Bot")[0].toUpperCase()}
        </div>
        <div style="display:flex;gap:5px;">
          <div class="dot" style="width:8px;height:8px;background:#ccc;border-radius:50%;animation:typing 1.4s infinite;"></div>
          <div class="dot" style="width:8px;height:8px;background:#ccc;border-radius:50%;animation:typing 1.4s infinite 0.2s;"></div>
          <div class="dot" style="width:8px;height:8px;background:#ccc;border-radius:50%;animation:typing 1.4s infinite 0.4s;"></div>
        </div>
      </div>
    </div>

    <div id="contextgpt-chat-input-container">
      <div id="contextgpt-chat-input-wrapper">
        <textarea id="contextgpt-chat-input" placeholder="${CONFIG.appearance.inputPlaceholderText || "Type your message..."}" rows="1" style="flex:1;border-radius:24px;padding:12px 16px;border:1px solid #ddd;resize:none;font-size:15px;"></textarea>
        <button id="contextgpt-send-button">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes typing { 0%,60%,100% {transform:translateY(0)} 30% {transform:translateY(-6px)} }
</style>
  `;

  const container = document.createElement("div");
  container.innerHTML = widgetHTML;
  document.body.appendChild(container.firstElementChild);

  // ─── Elements ───────────────────────────────────────
  const chatButton = document.getElementById("contextgpt-chat-button");
  const chatWindow = document.getElementById("contextgpt-chat-window");
  const closeButton = document.getElementById("contextgpt-close-button");
  const chatInput = document.getElementById("contextgpt-chat-input");
  const sendButton = document.getElementById("contextgpt-send-button");
  const messagesContainer = document.getElementById("contextgpt-chat-messages");
  const typingIndicator = document.querySelector(
    ".contextgpt-typing-indicator"
  );

  let isOpen = false;

  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.classList.toggle("open", isOpen);
    chatButton.classList.toggle("open", isOpen);
    if (isOpen) chatInput.focus();
  }

  chatButton.addEventListener("click", toggleChat);
  closeButton.addEventListener("click", toggleChat);

  // Auto-resize textarea
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
  });

  // Enter = send
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener("click", sendMessage);

  function addMessage(text, isUser = false) {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const html = `
      <div class="contextgpt-message ${isUser ? "user" : ""}">
        <div style="width:32px;height:32px;border-radius:50%;background:${isUser ? "#888" : "var(--brand-color,#0066ff)"};color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;flex-shrink:0;">
          ${isUser ? "U" : (CONFIG.chatbot.name || "Bot")[0].toUpperCase()}
        </div>
        <div style="max-width:78%;">
          <div style="padding:10px 14px;border-radius:18px;background:${isUser ? "var(--brand-color,#0066ff)" : "white"};color:${isUser ? "white" : "#111"};box-shadow:0 1px 2px rgba(0,0,0,0.08);">
            ${text}
          </div>
          <div style="font-size:11px;color:#777;margin-top:4px;padding-left:4px;">${time}</div>
        </div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML("beforeend", html);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    chatInput.value = "";
    chatInput.style.height = "auto";

    typingIndicator.style.display = "block";
    sendButton.disabled = true;

    try {
      const res = await fetch(API_BASE_URL + "/api/chat/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({
          chatbot_id: CHATBOT_ID,
          query: message,
        }),
      });

      const data = await res.json();

      typingIndicator.style.display = "none";
      sendButton.disabled = false;

      if (data?.success && data?.data?.answer) {
        addMessage(data.data.answer, false);
      } else {
        addMessage("Sorry, something went wrong. Try again?", false);
      }
    } catch (err) {
      console.error(err);
      typingIndicator.style.display = "none";
      sendButton.disabled = false;
      addMessage("Cannot connect right now. Please try later.", false);
    }
  }

  console.log("Widget loaded");
})();
