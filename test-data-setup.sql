-- ============================================
-- Test Data Setup for Widget System
-- User ID: 598e542f-3a11-4575-9f92-14749c91aa59
-- ============================================

-- 1. Create an Account for the user
INSERT INTO accounts (id, name, owner_id, created_at)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Test Account',
    '598e542f-3a11-4575-9f92-14749c91aa59',
    now()
);

-- 2. Add user as account member
INSERT INTO account_members (id, account_id, user_id, role, joined_at)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '598e542f-3a11-4575-9f92-14749c91aa59',
    'SUPER_ADMIN',
    now()
);

-- 3. Create a test chatbot
INSERT INTO user_chatbots (id, account_id, name, created_by_id, vector_namespace, vector_index_version, created_at, updated_at)
VALUES (
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    '11111111-1111-1111-1111-111111111111',
    'Test Support Chatbot',
    '598e542f-3a11-4575-9f92-14749c91aa59',
    'bot_93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    1,
    now(),
    now()
);

-- 4. Create chatbot general settings (includes LLM model)
INSERT INTO user_chatbot_settings_general (
    id, 
    chatbot_id, 
    description, 
    llm_model, 
    history_message_context,
    created_at, 
    updated_at
)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    'Customer support chatbot for testing',
    'gpt-5-nano',
    5,
    now(),
    now()
);

-- 5. Create chatbot appearance settings
INSERT INTO user_chatbot_appearance_ui (
    id,
    chatbot_id,
    tooltip,
    welcome_message,
    input_placeholder_text,
    brand_primary_color,
    brand_text_color,
    created_at,
    updated_at
)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    'Chat with us!',
    'Hello! How can I help you today?',
    'Type your message here...',
    '#007bff',
    '#ffffff',
    now(),
    now()
);

-- 6. Create chatbot behavior settings
INSERT INTO user_chatbot_behavior (
    id,
    chatbot_id,
    hide_sources,
    auto_open_chat_desktop,
    auto_open_chat_desktop_delay,
    created_at,
    updated_at
)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    false,
    false,
    3000,
    now(),
    now()
);

-- 7. Create widget configuration
INSERT INTO chatbot_widget_config (
    id,
    chatbot_id,
    allowed_domains,
    widget_enabled,
    widget_version,
    log_conversations,
    enable_analytics,
    created_at,
    updated_at
)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    ARRAY['localhost', 'localhost:3000', '127.0.0.1'],
    true,
    'v1',
    true,
    true,
    now(),
    now()
);

-- 8. Create rate limit rule for subscription plan (USER level)
INSERT INTO rate_limit_rules (
    id,
    subject_type,
    subject_id,
    limit_type,
    window_seconds,
    max_value,
    is_enabled,
    description,
    created_at,
    updated_at
)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'USER',
    '598e542f-3a11-4575-9f92-14749c91aa59',
    'messages',
    60,
    10000,
    true,
    'PRO plan rate limit: 10000 messages per minute',
    now(),
    now()
);

-- 9. Create or update website_subscriptions PRO plan
INSERT INTO website_subscriptions (
    id,
    type,
    price,
    chatbot_given,
    pages_upto,
    team_member_access,
    api_access,
    auto_sync_data,
    webhook_support,
    user_message_rate_limit,
    rate_limit_id,
    paddle_price_id,
    billing_interval,
    trial_period_days,
    trial_pages,
    trial_messages,
    trial_chatbots,
    created_at,
    updated_at
)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'PRO',
    49.00,
    50,
    10000,
    10,
    true,
    true,
    true,
    10000,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'price_test_pro_monthly',
    'monthly',                 -- ← changed here
    0, 0, 0, 0,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET
    rate_limit_id = EXCLUDED.rate_limit_id,
    user_message_rate_limit = EXCLUDED.user_message_rate_limit,
    updated_at = now();

-- 10. Create rate limit rule for the chatbot
INSERT INTO rate_limit_rules (
    id,
    subject_type,
    subject_id,
    limit_type,
    window_seconds,
    max_value,
    is_enabled,
    description,
    created_at,
    updated_at
)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    'CHATBOT',
    '93ab558e-8c8d-415e-8355-0fe0c1df4bb2',
    'messages',
    60,
    100,
    true,
    'Chatbot rate limit: 100 messages per minute',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 11. Create a subscription for the user
INSERT INTO users_subscriptions (
    id,
    user_id,
    subscription_id,
    paddle_customer_id,
    status,
    billing_interval,
    current_period_start,
    current_period_end,
    max_chatbots_allowed,
    max_pages_allowed,
    team_member_access,
    api_access,
    auto_sync_data,
    webhook_support,
    user_message_rate_limit,
    created_at,
    updated_at
)
VALUES (
    '88888888-8888-8888-8888-888888888888',
    '598e542f-3a11-4575-9f92-14749c91aa59',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ctm_test_customer',
    'active',
    'month',
    now(),
    now() + interval '1 month',
    50,
    10000,
    10,
    true,
    true,
    true,
    10000,
    now(),
    now()
);

-- 12. Create LLM model entry (if not exists)
INSERT INTO website_llm_models (
    id,
    provider,
    title,
    under_this_subscription_id,
    is_active,
    input_cost_per_1k,
    output_cost_per_1k,
    created_at,
    updated_at
)
VALUES (
    '99999999-9999-9999-9999-999999999999',
    'openai',
    'gpt-5-nano',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    true,
    0.00015,
    0.0006,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify chatbot exists
SELECT id, name, vector_namespace FROM user_chatbots 
WHERE id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';

-- Verify widget config
SELECT * FROM chatbot_widget_config 
WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';

-- Verify general settings
SELECT chatbot_id, llm_model FROM user_chatbot_settings_general 
WHERE chatbot_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';

-- Verify rate limit
SELECT * FROM rate_limit_rules 
WHERE subject_id = '93ab558e-8c8d-415e-8355-0fe0c1df4bb2';
