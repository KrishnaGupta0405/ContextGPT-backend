# Widget Testing Guide

## 🎯 Test Data Summary

**User ID:** `598e542f-3a11-4575-9f92-14749c91aa59`  
**Account ID:** `11111111-1111-1111-1111-111111111111`  
**Chatbot ID:** `93ab558e-8c8d-415e-8355-0fe0c1df4bb2`  
**Allowed Domains:** `localhost`, `localhost:3000`, `127.0.0.1`

---

## 📋 Step 1: Run SQL Setup

```bash
# Connect to your PostgreSQL database and run:
psql -U your_username -d your_database -f test-data-setup.sql
```

Or copy the SQL from `test-data-setup.sql` and run it in your database client.

---

## 🧪 Step 2: Test API Endpoints

### 1. Get Widget Configuration (Public)

```bash
curl http://localhost:8000/api/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/config
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "chatbot": {
      "id": "93ab558e-8c8d-415e-8355-0fe0c1df4bb2",
      "name": "Test Support Chatbot"
    },
    "config": {
      "widgetEnabled": true,
      "widgetVersion": "v1",
      "logConversations": true,
      "enableAnalytics": true
    },
    "appearance": {
      "tooltip": "Chat with us!",
      "welcomeMessage": "Hello! How can I help you today?",
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

### 2. Get Widget Script (Public)

```bash
curl http://localhost:8000/api/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/script.js
```

**Expected:** JavaScript code for the widget

---

### 3. Track Widget Session (Public)

```bash
curl -X POST http://localhost:8000/api/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/track \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_123",
    "originDomain": "localhost",
    "metadata": {
      "url": "http://localhost:3000/test",
      "referrer": "",
      "screenWidth": 1920,
      "screenHeight": 1080
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Session tracked",
  "data": {
    "id": "...",
    "sessionId": "test_session_123",
    "chatbotId": "93ab558e-8c8d-415e-8355-0fe0c1df4bb2"
  }
}
```

---

### 4. Send Chat Query (Public)

```bash
curl -X POST http://localhost:8000/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test_session_123" \
  -H "Origin: http://localhost" \
  -d '{
    "chatbot_id": "93ab558e-8c8d-415e-8355-0fe0c1df4bb2",
    "query": "What are your business hours?"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "answer": "...",
    "sources": [],
    "tokens": {
      "input": 25,
      "output": 150,
      "total": 175
    },
    "model": "gpt-5-nano",
    "responseTime": 1234
  }
}
```

---

### 5. Submit Feedback (Public)

```bash
curl -X POST http://localhost:8000/api/chat/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "chatbot_id": "93ab558e-8c8d-415e-8355-0fe0c1df4bb2",
    "session_id": "test_session_123",
    "feedback_type": "positive",
    "comment": "Very helpful!"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Feedback recorded successfully"
}
```

---

## 🔐 Authenticated Endpoints (Requires JWT)

### 6. Update Widget Config (Authenticated)

```bash
# First, get your JWT token by logging in
# Then use it in the Authorization header

curl -X PUT http://localhost:8000/api/widget/account/11111111-1111-1111-1111-111111111111/chatbot/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowedDomains": ["localhost", "example.com"],
    "widgetEnabled": true,
    "logConversations": true,
    "enableAnalytics": true
  }'
```

---

### 7. Get Widget Analytics (Authenticated)

```bash
curl http://localhost:8000/api/widget/account/11111111-1111-1111-1111-111111111111/chatbot/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/analytics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🌐 HTML Test Page

Create a file `test-widget.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Widget Test Page</title>
  </head>
  <body>
    <h1>Testing ContextGPT Widget</h1>
    <p>The widget should load below...</p>

    <!-- Widget Embed Code -->
    <script type="text/javascript">
      (function () {
        d = document;
        s = d.createElement("script");
        s.src =
          "http://localhost:8000/api/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2/script.js";
        s.async = 1;
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    </script>
  </body>
</html>
```

Open this file in your browser to test the widget.

---

## 🔍 Verify Data in Database

```sql
-- Check sessions created
SELECT * FROM chatbot_widget_sessions
WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'
ORDER BY started_at DESC;

-- Check interactions logged
SELECT * FROM chatbot_widget_interactions
WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'
ORDER BY created_at DESC;

-- Check rate limit consumption
SELECT * FROM users_rate_limit_consumption
WHERE subject_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';

-- Check usage tracking
SELECT * FROM users_usage_tracking
WHERE user_id = '598e542f-3a11-4575-9f92-14749c91aa59';
```

---

## ⚠️ Common Issues

### Issue: "Chatbot not found"

- Verify chatbot exists: `SELECT * FROM user_chatbots WHERE id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'`

### Issue: "Domain not authorized"

- Check widget config: `SELECT allowed_domains FROM chatbot_widget_config WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'`
- Make sure Origin header matches allowed domains

### Issue: "Rate limit exceeded"

- Check rate limit rules: `SELECT * FROM rate_limit_rules WHERE subject_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'`
- Clear consumption: `DELETE FROM users_rate_limit_consumption WHERE subject_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'`

### Issue: "Widget disabled"

- Update config: `UPDATE chatbot_widget_config SET widget_enabled = true WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2'`

---

## 📊 Expected Flow

1. ✅ Widget script loads on user's website
2. ✅ Session is created/tracked
3. ✅ Widget config is fetched
4. ✅ User sends query
5. ✅ Domain is validated
6. ✅ Rate limit is checked
7. ✅ LLM settings fetched from DB
8. ✅ Query sent to AWS Lambda
9. ✅ Response returned
10. ✅ Usage logged for billing
11. ✅ Interaction saved to database
