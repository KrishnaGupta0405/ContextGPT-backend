# Widget API Quick Reference

## 🔌 Public Endpoints (No Authentication)

### 1. Get Widget Configuration

```http
GET /api/widget/:chatbotId/config
```

**Response:**

```json
{
  "success": true,
  "data": {
    "chatbot": {
      "id": "uuid",
      "name": "My Chatbot"
    },
    "config": {
      "widgetEnabled": true,
      "widgetVersion": "v1",
      "logConversations": true,
      "enableAnalytics": true
    },
    "appearance": {
      "tooltip": "Chat with us!",
      "welcomeMessage": "Hello! How can I help?",
      "brandPrimaryColor": "#007bff",
      "brandTextColor": "#ffffff"
    },
    "behavior": {
      "hideSources": false,
      "autoOpenChatDesktop": false
    }
  }
}
```

---

### 2. Get Widget Script

```http
GET /api/widget/:chatbotId/script.js
```

**Response:** JavaScript file (application/javascript)

**Usage:**

```html
<script
  src="https://your-api.com/api/widget/YOUR_CHATBOT_ID/script.js"
  async
></script>
```

---

### 3. Track Widget Session

```http
POST /api/widget/:chatbotId/track
Content-Type: application/json
```

**Request Body:**

```json
{
  "sessionId": "sess_1234567890_abc123",
  "originDomain": "example.com",
  "metadata": {
    "url": "https://example.com/page",
    "referrer": "https://google.com",
    "screenWidth": 1920,
    "screenHeight": 1080
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Session tracked",
  "data": {
    "id": "uuid",
    "sessionId": "sess_1234567890_abc123",
    "startedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Send Chat Query

```http
POST /api/chat/query
Content-Type: application/json
X-Session-Id: sess_1234567890_abc123 (optional)
```

**Request Body:**

```json
{
  "chatbot_id": "uuid",
  "query": "What is your refund policy?",
  "provider": "openai",
  "llm_model": "gpt-4o-mini",
  "top_k": 5,
  "temperature": 0.7,
  "words": 120,
  "session_id": "sess_1234567890_abc123"
}
```

**Response Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "answer": "Our refund policy allows returns within 30 days...",
    "sources": [
      {
        "title": "Refund Policy",
        "url": "https://example.com/refund-policy",
        "snippet": "..."
      }
    ],
    "tokens": {
      "input": 25,
      "output": 150,
      "total": 175
    },
    "model": "gpt-4o-mini",
    "responseTime": 1234
  }
}
```

**Error Response (429 - Rate Limited):**

```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again in 30 seconds."
}
```

**Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
Retry-After: 30
```

**Error Response (403 - Domain Not Allowed):**

```json
{
  "success": false,
  "message": "Domain not authorized. Please contact the chatbot owner."
}
```

---

### 5. Submit Feedback

```http
POST /api/chat/feedback
Content-Type: application/json
```

**Request Body:**

```json
{
  "chatbot_id": "uuid",
  "session_id": "sess_1234567890_abc123",
  "interaction_id": "uuid",
  "feedback_type": "positive",
  "comment": "Very helpful response!"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Feedback recorded successfully"
}
```

---

## 🔐 Authenticated Endpoints (Requires JWT)

### 6. Update Widget Configuration

```http
PUT /api/widget/account/:accountId/chatbot/:chatbotId/config
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "allowedDomains": ["example.com", "app.example.com"],
  "widgetEnabled": true,
  "logConversations": true,
  "enableAnalytics": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Widget configuration updated successfully",
  "data": {
    "id": "uuid",
    "chatbotId": "uuid",
    "allowedDomains": ["example.com", "app.example.com"],
    "widgetEnabled": true,
    "widgetVersion": "v1",
    "logConversations": true,
    "enableAnalytics": true,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 7. Get Widget Analytics

```http
GET /api/widget/account/:accountId/chatbot/:chatbotId/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <JWT_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalSessions": 1250,
      "totalMessages": 4500,
      "uniqueDomains": 3,
      "avgMessagesPerSession": 3.6
    },
    "recentSessions": [
      {
        "id": "uuid",
        "sessionId": "sess_xxx",
        "originDomain": "example.com",
        "messagesCount": 5,
        "startedAt": "2024-01-15T10:30:00Z",
        "lastActivityAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

---

## 🚨 Error Codes

| Code | Message               | Description                               |
| ---- | --------------------- | ----------------------------------------- |
| 400  | Bad Request           | Missing required fields                   |
| 403  | Forbidden             | Domain not whitelisted or widget disabled |
| 404  | Not Found             | Chatbot not found                         |
| 429  | Too Many Requests     | Rate limit exceeded                       |
| 500  | Internal Server Error | Server error occurred                     |

---

## 📊 Rate Limit Headers

All `/api/chat/query` requests include:

```
X-RateLimit-Limit: 1000        # Maximum requests allowed
X-RateLimit-Remaining: 999     # Requests remaining in window
Retry-After: 30                # Seconds to wait (only if rate limited)
```

---

## 🎯 Widget Integration Example

### Complete HTML Example:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Website</title>
  </head>
  <body>
    <h1>Welcome to My Website</h1>

    <!-- Your content here -->

    <!-- ContextGPT Widget -->
    <script type="text/javascript">
      (function () {
        d = document;
        s = d.createElement("script");
        s.src =
          "https://api.contextgpt.com/api/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/script.js";
        s.async = 1;
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    </script>
  </body>
</html>
```

---

## 🔧 Testing with cURL

### Test Widget Config:

```bash
curl https://api.contextgpt.com/api/widget/YOUR_CHATBOT_ID/config
```

### Test Chat Query:

```bash
curl -X POST https://api.contextgpt.com/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test_session_123" \
  -d '{
    "chatbot_id": "YOUR_CHATBOT_ID",
    "query": "What are your business hours?",
    "provider": "openai",
    "llm_model": "gpt-4o-mini",
    "top_k": 5,
    "temperature": 0.7,
    "words": 120
  }'
```

### Update Widget Config (Authenticated):

```bash
curl -X PUT https://api.contextgpt.com/api/widget/account/ACCOUNT_ID/chatbot/CHATBOT_ID/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowedDomains": ["example.com"],
    "widgetEnabled": true,
    "logConversations": true,
    "enableAnalytics": true
  }'
```

---

## 📝 Notes

1. **Session ID**: Generated client-side and stored in sessionStorage
2. **Domain Validation**: Only enforced if `allowedDomains` is configured
3. **Rate Limiting**: Applied per chatbot, not per user
4. **CORS**: Enabled for all origins on public endpoints
5. **Caching**: Widget script cached for 1 hour
6. **Privacy**: Conversation logging respects `logConversations` setting
