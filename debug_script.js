
(function() {
  'use strict';
  
  const CHATBOT_ID = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';
  const API_BASE_URL = 'http://localhost:8000';
  const WIDGET_VERSION = 'v1';
  
  // Configuration from backend
  const CONFIG = {
    chatbot: {"id":"93ab558e-8c8d-415e-8355-0fe0c1df4bb2","accountId":"11111111-1111-1111-1111-111111111111","createdById":"598e542f-3a11-4575-9f92-14749c91aa59","createdAt":"2026-02-02 09:08:43.899146","updatedAt":"2026-02-02 09:08:43.899146","name":"Test Support Chatbot","vectorNamespace":"bot_93ab558e-8c8d-415e-8355-0fe0c1df4bb2","vectorIndexVersion":1},
    appearance: {"id":"44444444-4444-4444-4444-444444444444","chatbotId":"93ab558e-8c8d-415e-8355-0fe0c1df4bb2","tooltip":"Chat with us!","welcomeMessage":"Hello! How can I help you today?","inputPlaceholderText":"Type your message here...","brandPrimaryColor":"#007bff","brandTextColor":"#ffffff","brandIconBgColor":null,"showBackground":true,"linkColor":null,"fontSize":null,"chatHeight":null,"externalLink":null,"iconSize":null,"iconPosition":null,"defaultMode":null,"watermarkBrandIcon":null,"watermarkBrandText":null,"watermarkBrandLink":null,"watermarkBrandInfoShow":true,"hideWatermarkSitegpt":false,"rightToLeftMode":false,"enableDarkMode":false,"distanceFromBottom":null,"horizontalDistance":null,"botIconSrc":null,"userIconSrc":null,"agentIconSrc":null,"bubbleIconSrc":null,"createdAt":"2026-02-02 09:09:03.636966","updatedAt":"2026-02-02 09:09:03.636966"},
    behavior: {"id":"55555555-5555-5555-5555-555555555555","chatbotId":"93ab558e-8c8d-415e-8355-0fe0c1df4bb2","hideSources":false,"hideTooltip":false,"hideFeedbackButtons":false,"hideBottomNavigation":false,"hideRefreshButton":false,"hideExpandButton":false,"hideHomePage":false,"stayOnHomePage":false,"requireTermsAcceptance":false,"disclaimerText":null,"autoOpenChatDesktop":false,"autoOpenChatDesktopDelay":3000,"autoOpenChatMobile":false,"autoOpenChatMobileDelay":null,"smartFollowUpPromptsCount":null,"createdAt":"2026-02-02 09:09:09.667593","updatedAt":"2026-02-02 09:09:09.667593"},
  };
  
  // Generate unique session ID
  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Get or create session ID
  let sessionId = sessionStorage.getItem('chatbot_session_' + CHATBOT_ID);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('chatbot_session_' + CHATBOT_ID, sessionId);
  }
  
  // Track session
  fetch(API_BASE_URL + '/api/widget/' + CHATBOT_ID + '/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: sessionId,
      originDomain: window.location.hostname,
      metadata: {
        url: window.location.href,
        referrer: document.referrer,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      }
    })
  }).catch(err => console.error('Failed to track session:', err));
  
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    #contextgpt-widget-container * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    #contextgpt-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    /* Chat Button */
    #contextgpt-chat-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${CONFIG.appearance.brandPrimaryColor || '#007bff'} 0%, ${CONFIG.appearance.brandPrimaryColor || '#0056b3'} 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      position: relative;
    }
    
    #contextgpt-chat-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }
    
    #contextgpt-chat-button svg {
      width: 28px;
      height: 28px;
      fill: white;
      transition: transform 0.3s ease;
    }
    
    #contextgpt-chat-button.open svg {
      transform: rotate(90deg);
    }
    
    /* Chat Window */
    #contextgpt-chat-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }
    
    #contextgpt-chat-window.open {
      display: flex;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Chat Header */
    #contextgpt-chat-header {
      background: linear-gradient(135deg, ${CONFIG.appearance.brandPrimaryColor || '#007bff'} 0%, ${CONFIG.appearance.brandPrimaryColor || '#0056b3'} 100%);
      color: white;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    #contextgpt-chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    #contextgpt-chat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: bold;
    }
    
    #contextgpt-chat-title {
      font-size: 16px;
      font-weight: 600;
    }
    
    #contextgpt-chat-status {
      font-size: 12px;
      opacity: 0.9;
    }
    
    #contextgpt-close-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 5px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    #contextgpt-close-button:hover {
      opacity: 1;
    }
    
    /* Chat Messages */
    #contextgpt-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f8f9fa;
    }
    
    #contextgpt-chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    #contextgpt-chat-messages::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 3px;
    }
    
    .contextgpt-message {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .contextgpt-message.user {
      flex-direction: row-reverse;
    }
    
    .contextgpt-message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${CONFIG.appearance.brandPrimaryColor || '#007bff'};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
      flex-shrink: 0;
    }
    
    .contextgpt-message.user .contextgpt-message-avatar {
      background: #6c757d;
    }
    
    .contextgpt-message-content {
      max-width: 75%;
    }
    
    .contextgpt-message-bubble {
      background: white;
      padding: 12px 16px;
      border-radius: 18px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      word-wrap: break-word;
      line-height: 1.5;
      font-size: 14px;
    }
    
    .contextgpt-message.user .contextgpt-message-bubble {
      background: ${CONFIG.appearance.brandPrimaryColor || '#007bff'};
      color: white;
    }
    
    .contextgpt-message-time {
      font-size: 11px;
      color: #6c757d;
      margin-top: 4px;
      padding: 0 8px;
    }
    
    /* Typing Indicator */
    .contextgpt-typing-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .contextgpt-typing-indicator.active {
      display: flex;
    }
    
    .contextgpt-typing-dots {
      background: white;
      padding: 12px 16px;
      border-radius: 18px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 4px;
    }
    
    .contextgpt-typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cbd5e0;
      animation: typing 1.4s infinite;
    }
    
    .contextgpt-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .contextgpt-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
    }
    
    /* Chat Input */
    #contextgpt-chat-input-container {
      padding: 16px;
      background: white;
      border-top: 1px solid #e9ecef;
    }
    
    #contextgpt-chat-input-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    
    #contextgpt-chat-input {
      flex: 1;
      border: 1px solid #dee2e6;
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      max-height: 100px;
      outline: none;
      transition: border-color 0.2s;
    }
    
    #contextgpt-chat-input:focus {
      border-color: ${CONFIG.appearance.brandPrimaryColor || '#007bff'};
    }
    
    #contextgpt-send-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${CONFIG.appearance.brandPrimaryColor || '#007bff'};
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    
    #contextgpt-send-button:hover:not(:disabled) {
      background: ${CONFIG.appearance.brandPrimaryColor || '#0056b3'};
      transform: scale(1.05);
    }
    
    #contextgpt-send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    #contextgpt-send-button svg {
      width: 18px;
      height: 18px;
      fill: white;
    }
    
    /* Welcome Message */
    .contextgpt-welcome-message {
      background: white;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .contextgpt-welcome-message h3 {
      font-size: 16px;
      margin-bottom: 8px;
      color: #212529;
    }
    
    .contextgpt-welcome-message p {
      font-size: 14px;
      color: #6c757d;
      line-height: 1.5;
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
      #contextgpt-chat-window {
        width: calc(100vw - 20px);
        height: calc(100vh - 100px);
        bottom: 70px;
        right: 10px;
      }
      
      #contextgpt-widget-container {
        bottom: 10px;
        right: 10px;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Create widget HTML
  const widgetHTML = `
    <div id="contextgpt-widget-container">
      <button id="contextgpt-chat-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
      
      <div id="contextgpt-chat-window">
        <div id="contextgpt-chat-header">
          <div id="contextgpt-chat-header-info">
            <div id="contextgpt-chat-avatar">${(CONFIG.chatbot.name || 'Bot')[0].toUpperCase()}</div>
            <div>
              <div id="contextgpt-chat-title">${CONFIG.chatbot.name || 'Chat Support'}</div>
              <div id="contextgpt-chat-status">Online</div>
            </div>
          </div>
          <button id="contextgpt-close-button" aria-label="Close chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div id="contextgpt-chat-messages">
          <div class="contextgpt-welcome-message">
            <h3>${CONFIG.appearance.welcomeMessage || 'Welcome! 👋'}</h3>
            <p>How can we help you today?</p>
          </div>
        </div>
        
        <div class="contextgpt-typing-indicator">
          <div class="contextgpt-message-avatar">${(CONFIG.chatbot.name || 'Bot')[0].toUpperCase()}</div>
          <div class="contextgpt-typing-dots">
            <div class="contextgpt-typing-dot"></div>
            <div class="contextgpt-typing-dot"></div>
            <div class="contextgpt-typing-dot"></div>
          </div>
        </div>
        
        <div id="contextgpt-chat-input-container">
          <div id="contextgpt-chat-input-wrapper">
            <textarea 
              id="contextgpt-chat-input" 
              placeholder="${CONFIG.appearance.inputPlaceholderText || 'Type your message...'}"
              rows="1"
            ></textarea>
            <button id="contextgpt-send-button" aria-label="Send message">
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Insert widget into page
  const container = document.createElement('div');
  container.innerHTML = widgetHTML;
  document.body.appendChild(container.firstElementChild);
  
  // Widget functionality
  const chatButton = document.getElementById('contextgpt-chat-button');
  const chatWindow = document.getElementById('contextgpt-chat-window');
  const closeButton = document.getElementById('contextgpt-close-button');
  const chatInput = document.getElementById('contextgpt-chat-input');
  const sendButton = document.getElementById('contextgpt-send-button');
  const messagesContainer = document.getElementById('contextgpt-chat-messages');
  const typingIndicator = document.querySelector('.contextgpt-typing-indicator');
  
  let isOpen = false;
  
  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.classList.toggle('open', isOpen);
    chatButton.classList.toggle('open', isOpen);
    if (isOpen) {
      chatInput.focus();
    }
  }
  
  chatButton.addEventListener('click', toggleChat);
  closeButton.addEventListener('click', toggleChat);
  
  // Auto-resize textarea
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
  
  // Send message on Enter (Shift+Enter for new line)
  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  sendButton.addEventListener('click', sendMessage);
  
  // Add message to chat
  function addMessage(text, isUser = false) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const messageHTML = `
      <div class="contextgpt-message ${isUser ? 'user' : 'bot'}">
        <div class="contextgpt-message-avatar">${isUser ? 'U' : (CONFIG.chatbot.name || 'Bot')[0].toUpperCase()}</div>
        <div class="contextgpt-message-content">
          <div class="contextgpt-message-bubble">${text}</div>
          <div class="contextgpt-message-time">${time}</div>
        </div>
      </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Send message function
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, true);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Show typing indicator
    typingIndicator.classList.add('active');
    sendButton.disabled = true;
    
    try {
      // Send to backend
      const response = await fetch(API_BASE_URL + '/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({
          chatbot_id: CHATBOT_ID,
          query: message,
        })
      });
      
      const data = await response.json();
      
      // Hide typing indicator
      typingIndicator.classList.remove('active');
      sendButton.disabled = false;
      
      if (data.success && data.data.answer) {
        addMessage(data.data.answer, false);
      } else {
        addMessage('Sorry, I encountered an error. Please try again.', false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      typingIndicator.classList.remove('active');
      sendButton.disabled = false;
      addMessage('Sorry, I could not connect to the server. Please try again later.', false);
    }
  }
  
  console.log('✅ ContextGPT Widget loaded successfully');
})();
