--Even though db has underspacing like password_hash, but
-- drizzle convert it to the           passwordHash
 
-- Required once per database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--Make all the timestamp according to international timezone only
--===================================================================================
-- Global Application Error Logging

CREATE TABLE application_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Error Classification
    error_type VARCHAR(50) NOT NULL,        -- DATABASE | AUTHENTICATION | VALIDATION | API | S3 | LAMBDA | UNKNOWN
    severity VARCHAR(20) NOT NULL,          -- INFO | WARN | ERROR | CRITICAL
    
    -- Request Context
    endpoint VARCHAR(255),                  -- API endpoint that failed
    method VARCHAR(10),                     -- GET | POST | PUT | DELETE
    request_ip INET,                        -- Client IP
    user_agent TEXT,                        -- User agent string
    
    -- User Context (nullable for unauthenticated requests)
    user_id UUID,                           -- FK → users.id (nullable)
    chatbot_id UUID,                        -- FK → user_chatbots.id (nullable)
    
    -- Error Details
    error_code VARCHAR(50),                 -- HTTP status code or custom error code
    error_message TEXT NOT NULL,            -- Human-readable error message
    error_stack TEXT,                       -- Full stack trace
    
    -- Additional Context
    request_body JSONB,                     -- Request payload (sanitized)
    request_params JSONB,                   -- URL params
    request_query JSONB,                    -- Query string params
    metadata JSONB,                         -- Any additional context
    
    -- Tracking
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by UUID,                       -- FK → users.id (admin who resolved)
    
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_app_error_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_app_error_chatbot 
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE SET NULL
);

--===================================================================================
--Website

CREATE TABLE website_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type VARCHAR(50) NOT NULL,               -- FREE | PRO | ENTERPRISE
    price NUMERIC(10,2) NOT NULL DEFAULT 0,

    chatbot_given INTEGER NOT NULL,
    pages_upto INTEGER NOT NULL,
    team_member_access INTEGER NOT NULL,

    api_access BOOLEAN NOT NULL DEFAULT FALSE,
    auto_sync_data BOOLEAN NOT NULL DEFAULT FALSE,

    auto_sync_data_occurrence VARCHAR(20),   -- monthly | weekly | daily refresh

    webhook_support BOOLEAN NOT NULL DEFAULT FALSE,

    platform_integration_allowed TEXT[] NULL,    -- {'MESSENGER','CRISP','ZOHO_SALESIQ'}
    custom_platform_integration BOOLEAN NOT NULL DEFAULT FALSE,

    user_message_rate_limit INTEGER NOT NULL,  --Amount of messages allowed in given window frame
    rate_limit_id UUID NOT NULL, -- FK → rate_limit_rules.id
    
    paddle_price_id TEXT UNIQUE, -- this is paddle product link
    billing_interval VARCHAR(20) CHECK (billing_interval IN ('month', 'year')),

    trial_period_days INTEGER DEFAULT 0,
    trial_pages INTEGER DEFAULT 0,
    trial_messages INTEGER DEFAULT 0,
    trial_chatbots INTEGER DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_rate_limit
        FOREIGN KEY (rate_limit_id)
        REFERENCES rate_limit_rules(id)
        ON DELETE CASCADE,
    
    CONSTRAINT chk_auto_sync_occurrence
        CHECK (
            auto_sync_data = FALSE
            OR auto_sync_data_occurrence IN ('monthly','weekly','daily')
        )
);

CREATE TABLE rate_limit_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('USER', 'API_KEY', 'CHATBOT')),
    subject_id UUID NOT NULL,
    limit_type VARCHAR(40) NOT NULL CHECK (limit_type IN (
        'messages', 'tokens', 'pages_indexed', 'chatbot_creations'
    )),
    model_name VARCHAR(100), -- NULL = applies to all models
    window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
    max_value INTEGER NOT NULL CHECK (max_value >= 0),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority SMALLINT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_rate_limit_rule UNIQUE (subject_type, subject_id, limit_type, model_name, window_seconds)
);

CREATE TABLE website_add_ons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,  --"Remove SiteGPT Branding +$59/mo | Extra 5k Messages +$59 /mo"
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    paddle_price_id TEXT UNIQUE, -- this is paddle product link
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_website_add_ons_title ON website_add_ons(title);

--Promo, Referral provide bonus pages and messages not the discount
CREATE TABLE website_promotion_referral (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core promotion info
    promotion_share_text TEXT NOT NULL,
    promo_code          VARCHAR(20) UNIQUE,
    
    -- Per-referral (User referring the product) reward
    message_added       INTEGER DEFAULT 0,
    pages_added         INTEGER DEFAULT 0,
    
    reward_target       VARCHAR(20) NOT NULL DEFAULT 'BOTH'
        CHECK (reward_target IN ('REFERRER', 'REFERRED', 'BOTH', 'NONE')),
    
    -- Milestone / tiered rewards to increase the referral count
    milestone_rewards   JSONB DEFAULT '[]'::JSONB,
    
    -- Campaign control, as referral can be on new users only !!
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    target_audience     VARCHAR(20) NOT NULL 
        CHECK (target_audience IN ('NEW_USERS', 'EXISTING_USERS', 'ALL')),
    
    -- Cycle logic, for monthly referral repeatation
    cycle_type          VARCHAR(20) NOT NULL DEFAULT 'LIFETIME'
        CHECK (cycle_type IN ('LIFETIME', 'MONTHLY', 'WEEKLY')),
    
    -- This is non-referral bonus, Non-cycle bonus- not milestone base
    signup_messages_bonus INTEGER DEFAULT 0,
    signup_pages_bonus    INTEGER DEFAULT 0,

    -- Optional time bounding
    starts_at           TIMESTAMP,
    expires_at          TIMESTAMP,
    
    -- If it is referral or direct promotion code...
    promotion_type VARCHAR(20) DEFAULT 'REFERRAL'
        CHECK (promotion_type IN ('REFERRAL', 'DIRECT')),

    -- Tracking & admin
    created_by          UUID REFERENCES users(id),
    description         TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- Milestone JSONB FORMAT inside website_promotion_referral
-- [
--   {
--     "count": 5,
--     "messages": 100,
--     "pages": 50,
--     "description": "First 5 referrals bonus"
--   },
--   {
--     "count": 10,
--     "messages": 250,
--     "pages": 100,
--     "description": "10 referrals milestone"
--   },
--   {
--     "count": 25,
--     "messages": 500,
--     "pages": 250,
--     "description": "25 referrals milestone"
--   }
-- ]
-- CREATE INDEX idx_promo_code_active 
--     ON website_promotion_referral(promo_code) 
--     WHERE is_active = true;

-- CREATE INDEX idx_promotion_active_audience  
--     ON website_promotion_referral(is_active, target_audience);

-- CREATE INDEX idx_promotion_dates            
--     ON website_promotion_referral(starts_at, expires_at);


CREATE INDEX idx_promo_code ON website_promotion_referral(promo_code);


CREATE INDEX idx_milestones_promotion ON promotion_milestones(promotion_id);

CREATE TABLE website_llm_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                -- e.g. gpt-4.1-mini
    provider VARCHAR(50) NOT NULL,              -- openai | anthropic | google
    title VARCHAR(100) NOT NULL,

    under_this_subscription_id UUID NOT NULL,  --FK → website_subscriptions.id
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    input_cost_per_1k NUMERIC(10,6),
    output_cost_per_1k NUMERIC(10,6),
    
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_llm_subscription
        FOREIGN KEY (under_this_subscription_id)
        REFERENCES website_subscriptions(id)
        ON DELETE CASCADE
);
CREATE INDEX idx_llm_models_provider ON website_llm_models(provider);


--===================================================================================


CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL,
    
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT fk_account_owner
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_account_name
        UNIQUE (name)
);
-- CREATE INDEX idx_accounts_owner ON accounts(owner_id);

--Account level maintaince/invitation
CREATE TABLE account_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL, -- OWNER | ADMIN | MEMBER

    joined_at TIMESTAMP DEFAULT now(),

    CONSTRAINT fk_am_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,

    CONSTRAINT fk_am_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT uq_account_user UNIQUE (account_id, user_id),

    CONSTRAINT chk_account_role
        CHECK (role IN ('SUPER_ADMIN','ADMIN','MANAGER','AGENT'))
);
-- CREATE INDEX idx_account_members_account ON account_members(account_id);
-- CREATE INDEX idx_account_members_user ON account_members(user_id);

CREATE TABLE account_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL,
    email VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL, -- SUPER_ADMIN | ADMIN | MANAGER | AGENT
    invited_by_id UUID NOT NULL,
    token VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    expires_at TIMESTAMP DEFAULT (now() + interval '7 days'),

    -- Optional resource scoping
    scope VARCHAR(20) DEFAULT 'ACCOUNT', 
    resource_id UUID, -- chatbot_id if scope = CHATBOT

    CONSTRAINT fk_ai_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,

    CONSTRAINT fk_ai_inviter
        FOREIGN KEY (invited_by_id) REFERENCES users(id),

    CONSTRAINT chk_ai_status
        CHECK (status IN ('PENDING','ACCEPTED','EXPIRED')),

    CONSTRAINT chk_ai_scope
        CHECK (scope IN ('ACCOUNT','CHATBOT'))
);
CREATE INDEX idx_account_invitations_accountId ON account_invitations(account_id);
CREATE INDEX idx_account_invitations_invited_by ON account_invitations(invited_by_id);

--===================================================================================
--Users


CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(50),
    avatar TEXT,
    password TEXT,

    FaceBook_link TEXT,
    instagram_link TEXT,
    linkedin_link TEXT,
    twitter_link TEXT,
    youtube_link TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_name ON users(name);

CREATE TABLE users_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL, -- FK → users.id

    refresh_token TEXT, -- nullable on logout
    device_info TEXT,   -- user-agent
    ip_address TEXT,

    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_users_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE users_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id             UUID NOT NULL,
    subscription_id     UUID NOT NULL,               -- FK → website_subscriptions (your plan catalog)

    -- ── Paddle identifiers (critical) ───────────────────────────────────────
    paddle_subscription_id  TEXT UNIQUE,               -- sub_01j...
    paddle_customer_id      TEXT NOT NULL,             -- ctm_01j...
    paddle_transaction_id TEXT, -- txn_01j... (first purchase transaction)

    -- ── Status & lifecycle ──────────────────────────────────────────────────
    status              VARCHAR(30) NOT NULL 
                        CHECK (status IN (
                            'incomplete', 'trialing', 'active',
                            'past_due', 'paused', 'canceled'
                        )),

    -- ── Billing cycle ───────────────────────────────────────────────────────
    billing_interval VARCHAR(20) CHECK (billing_interval IN ('month', 'year')),
    billing_interval_count INTEGER DEFAULT 1, -- e.g., 3 for quarterly
    collection_mode VARCHAR(20) DEFAULT 'automatic' CHECK (collection_mode IN ('automatic', 'manual')),
    current_period_start  TIMESTAMPTZ NOT NULL,
    current_period_end    TIMESTAMPTZ NOT NULL,
    next_billed_at        TIMESTAMPTZ,                 -- very useful
    paused_at             TIMESTAMPTZ,
    canceled_at           TIMESTAMPTZ,
    ends_at               TIMESTAMPTZ,                 -- computed: effective access end date

    cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Add columns to track trial usage
    is_trial BOOLEAN NOT NULL DEFAULT FALSE,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at   TIMESTAMPTZ,                 -- null if no trial
    trial_pages_used INTEGER DEFAULT 0,
    trial_messages_used INTEGER DEFAULT 0,
    trial_chatbots_used INTEGER DEFAULT 0,
    trial_pages_limit INTEGER DEFAULT 0,
    trial_messages_limit INTEGER DEFAULT 0,
    trial_chatbots_limit INTEGER DEFAULT 0,

    -- Optional: store future scheduled action (upgrade/downgrade/pause/cancel)
    scheduled_change      JSONB,                       -- whole Paddle scheduled_change object

    -- ── Plan snapshot (keep as-is) ──────────────────────────────────────────
    max_chatbots_allowed  INTEGER NOT NULL,
    max_pages_allowed     INTEGER NOT NULL,
    team_member_access    INTEGER NOT NULL,
    api_access            BOOLEAN NOT NULL,
    auto_sync_data        BOOLEAN NOT NULL,
    webhook_support       BOOLEAN NOT NULL,

    user_message_rate_limit INTEGER NOT NULL,

    -- Bonuses (unchanged)
    bonus_title           VARCHAR(100),
    bonus_messages        INTEGER DEFAULT 0,
    bonus_pages           INTEGER DEFAULT 0,
    expiry_date           TIMESTAMP,

    -- Optional nice-to-haves
    currency              VARCHAR(3) DEFAULT 'USD',
    total_price           NUMERIC(12,2),               -- final amount per cycle
    management_urls       JSONB,                       -- update_url, cancel_url, ...

    created_at            TIMESTAMP NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_us_user         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_us_subscription FOREIGN KEY (subscription_id) REFERENCES website_subscriptions(id) ON DELETE RESTRICT
);

CREATE TABLE paddle_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    event_id TEXT UNIQUE NOT NULL,           -- evt_01j... (Paddle's event ID)
    event_type VARCHAR(100) NOT NULL,        -- subscription.created, transaction.completed, etc.
    
    paddle_subscription_id TEXT,             -- if event relates to subscription
    paddle_customer_id TEXT,
    paddle_transaction_id TEXT,
    
    idempotency_key TEXT UNIQUE,

    payload JSONB NOT NULL,                  -- full webhook payload
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    
    error_message TEXT,                      -- if processing failed
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_events_event_id ON paddle_webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON paddle_webhook_events(processed);

CREATE TABLE paddle_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID NOT NULL,
    paddle_transaction_id TEXT UNIQUE NOT NULL,
    paddle_subscription_id TEXT,             -- null for one-time purchases
    
    status VARCHAR(30) NOT NULL,             -- completed, canceled, past_due, etc.
    
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    
    receipt_url TEXT,
    invoice_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    
    CONSTRAINT fk_pt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_paddle_transactions_user ON paddle_transactions(user_id);
CREATE INDEX idx_paddle_transactions_date ON paddle_transactions(created_at);

CREATE TABLE users_addons_purchased (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL,                
    addon_id UUID NOT NULL,               
    subscription_id UUID NOT NULL,        

    remove_watermark BOOLEAN NOT NULL DEFAULT FALSE,
    priority_support BOOLEAN NOT NULL DEFAULT FALSE,
    customer_branding BOOLEAN NOT NULL DEFAULT FALSE,

    purchase_date TIMESTAMP NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Snapshot values at purchase time
    extra_messages_granted INTEGER NOT NULL DEFAULT 0,
    extra_chatbots_granted INTEGER NOT NULL DEFAULT 0,
    price_paid DECIMAL(10,2) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_uap_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT fk_uap_addon
        FOREIGN KEY (addon_id) REFERENCES website_add_ons(id) ON DELETE RESTRICT,

    CONSTRAINT fk_uap_subscription
        FOREIGN KEY (subscription_id) REFERENCES users_subscriptions(id) ON DELETE CASCADE
);


CREATE TABLE users_promotion_referrals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    referrer_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    promotion_id        UUID NOT NULL REFERENCES website_promotion_referral(id) ON DELETE RESTRICT,
    
    -- Cycle scoping (for monthly reset)
    cycle_key           DATE NOT NULL,
    -- Example: '2026-01-01' for Jan 2026
    
    redeemed_at         TIMESTAMP NOT NULL DEFAULT now(),
    
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCESSFUL', 'EXPIRED', 'CANCELED', 'CHARGEBACK')),
    
    confirmed_at        TIMESTAMP,
    
    -- Snapshot rewards
    referrer_messages   INTEGER DEFAULT 0,
    referrer_pages      INTEGER DEFAULT 0,
    referred_messages   INTEGER DEFAULT 0,
    referred_pages      INTEGER DEFAULT 0,
    
    -- Milestones triggered by this referral
    triggered_milestones JSONB DEFAULT '[]'::JSONB,

    -- Revenue proof
    subscription_id     UUID, -- FK → users_subscriptions.id
    
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_unique_referral_per_cycle 
        UNIQUE (referrer_user_id, referred_user_id, promotion_id, cycle_key),
        
    CONSTRAINT uq_referred_once_per_promo
        UNIQUE (referred_user_id, promotion_id),
        
    CONSTRAINT chk_no_self_referral 
        CHECK (referrer_user_id <> referred_user_id),
    
    CONSTRAINT fk_upr_subscription
        FOREIGN KEY (subscription_id) REFERENCES users_subscriptions(id) ON DELETE RESTRICT
);

-- Triggered milestone format inside triggered_milestones JSONB
-- [
--   {
--     "milestone_count": 5,
--     "triggered_at": "2026-01-24T23:00:00Z",
--     "messages_awarded": 100,
--     "pages_awarded": 50,
--     "referral_id": "uuid-of-the-referral-that-triggered-it"
--   },
--   {
--     "milestone_count": 10,
--     "triggered_at": "2026-01-24T23:30:00Z",
--     "messages_awarded": 250,
--     "pages_awarded": 100,
--     "referral_id": "uuid-of-the-referral-that-triggered-it"
--   }
-- ]

-- CREATE INDEX idx_referrals_referrer_status    
--     ON users_promotion_referrals(referrer_user_id, status, cycle_key);

-- CREATE INDEX idx_referrals_referred           
--     ON users_promotion_referrals(referred_user_id, status);

-- CREATE INDEX idx_referrals_promotion_status   
--     ON users_promotion_referrals(promotion_id, status, cycle_key);


CREATE TABLE users_rate_limit_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL, -- FK → rate_limit_rules.id
    subject_type VARCHAR(20) NOT NULL,
    subject_id UUID NOT NULL,
    limit_type VARCHAR(40) NOT NULL,
    consumed_value INTEGER NOT NULL DEFAULT 0, -- current consumption
    window_start TIMESTAMPTZ NOT NULL, -- when this window started
    window_end TIMESTAMPTZ NOT NULL, -- when this window expires
    metadata JSONB, -- store breakdown: {model: count, endpoint: count}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_consumption_rule FOREIGN KEY (rule_id) REFERENCES rate_limit_rules(id) ON DELETE CASCADE
);

CREATE TABLE users_llm_usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    chatbot_id UUID NOT NULL,
    thread_id UUID,
    message_id UUID NOT NULL, -- FK → user_chatbot_messages.id
    llm_model_id UUID NOT NULL,
    
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost NUMERIC(10,6) NOT NULL, -- calculated from model pricing
    
    latency_ms INTEGER, -- response time
    finish_reason VARCHAR(20), -- stop | length | content_filter
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_usage_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_usage_event_chatbot FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE,
    CONSTRAINT fk_usage_event_message FOREIGN KEY (message_id) REFERENCES user_chatbot_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_usage_event_model FOREIGN KEY (llm_model_id) REFERENCES website_llm_models(id) ON DELETE RESTRICT
);

CREATE TABLE users_usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    
    -- Billing period tracking
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Usage counters (reset each period)
    chatbots_created INTEGER NOT NULL DEFAULT 0,
    messages_sent INTEGER NOT NULL DEFAULT 0,
    messages_received INTEGER NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    pages_indexed INTEGER NOT NULL DEFAULT 0,
    team_members_added INTEGER NOT NULL DEFAULT 0,
    
    -- Limits snapshot (from subscription at period start)
    limit_chatbots INTEGER NOT NULL,
    limit_messages INTEGER NOT NULL,
    limit_pages INTEGER NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_ut_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ut_subscription FOREIGN KEY (subscription_id) REFERENCES users_subscriptions(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_period UNIQUE (user_id, period_start) -- Allow multiple subscriptions
);

--Single Api key used to access all the chatbot under one account     
CREATE TABLE users_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- FK → users.id

    api_key VARCHAR(255) UNIQUE NOT NULL, -- Actual API secret
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMP, -- Last time key was used
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Soft-disable flag

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Key creation time
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Key update time
    
    CONSTRAINT fk_api_keys_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_api_keys_key_active ON users_api_keys(api_key) WHERE is_active = TRUE; -- to check for incoming request
CREATE INDEX idx_api_keys_user ON users_api_keys(user_id);  --> to update the already existing key

CREATE TABLE users_api_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    api_key_id UUID NOT NULL,
    
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    
    request_ip INET,
    user_agent TEXT,
    
    -- ➕ ADD: Performance tracking
    request_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), -- ⚠️ Rename from created_at
    response_timestamp TIMESTAMPTZ, -- ✅ Keep but make it TIMESTAMPTZ
    duration_ms INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (response_timestamp - request_timestamp)) * 1000
    ) STORED, -- Auto-calculate duration
    
    -- ➕ ADD: Resource usage (critical for billing!)
    request_size_bytes INTEGER, -- Size of request body
    response_size_bytes INTEGER, -- Size of response body
    
    -- ➕ ADD: For LLM API endpoints
    tokens_used INTEGER, -- If this was a chat/completion request
    llm_model_id UUID, -- FK → website_llm_models.id
    
    -- ➕ ADD: Rate limiting support
    rate_limit_key VARCHAR(100), -- "user:123:messages" or "api_key:456:tokens"
    rate_limited BOOLEAN NOT NULL DEFAULT FALSE, -- Was this request rate limited?
    retry_after INTEGER, -- Seconds until retry (if rate limited)
    
    -- ✅ KEEP: Error tracking
    error BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT, -- ➕ ADD: Actual error details
    
    -- ⚠️ REMOVE created_at (use request_timestamp instead)
    
    CONSTRAINT fk_api_request_logs_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_api_request_logs_api_key 
        FOREIGN KEY (api_key_id) REFERENCES users_api_keys(id) ON DELETE CASCADE,
    CONSTRAINT fk_api_request_logs_model
        FOREIGN KEY (llm_model_id) REFERENCES website_llm_models(id) ON DELETE SET NULL
);
CREATE INDEX idx_api_request_logs_user_id ON users_api_request_logs(user_id);
CREATE INDEX idx_api_request_logs_api_key_id ON users_api_request_logs(api_key_id);

--===================================================================================
--Chatbot

CREATE TABLE user_chatbots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- User chatbot ID
    account_id UUID NOT NULL, -- Owner account ID (used for chatbot count limits)
    name VARCHAR(100) NOT NULL,
    created_by_id UUID NOT NULL, -- Creator user ID

    vector_namespace TEXT,
    vector_index_version INT DEFAULT 1,
    --     id                                   | vector_namespace
    -- -------------------------------------|-------------------------
    -- 550e8400-e29b-41d4-a716-446655440000 | bot_550e8400-e29b-41d4-a716-446655440000
    -- ...                                  | bot_550e8400...:v2     ← after re-index

    -- Now your runtime always queries: namespace = user_chatbots.vector_namespace
    -- When you change embeddings:
    --           UPDATE user_chatbots
    --           SET vector_index_version = vector_index_version + 1,
    --           vector_namespace = 'bot123:v2'

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_user_chatbots_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,

    CONSTRAINT fk_user_chatbots_creator
        FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
    -- under same account unique chatbot name should exist
    CONSTRAINT unique_account_chatbot_name
        UNIQUE (account_id, name)
);
CREATE INDEX idx_user_chatbots_account ON user_chatbots(account_id);
CREATE INDEX idx_user_chatbots_creator ON user_chatbots(created_by_id);

CREATE TABLE user_chatbot_appearance_ui (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Appearance settings ID
    chatbot_id UUID UNIQUE NOT NULL, -- FK → user_chatbots.id

    tooltip TEXT, -- Tooltip text
    welcome_message TEXT, -- Welcome message
    input_placeholder_text TEXT, -- Input placeholder

    brand_primary_color VARCHAR(7), -- Brand primary hex color
    brand_text_color VARCHAR(7), -- Brand text hex color
    brand_icon_bg_color VARCHAR(7), -- Icon background color
    show_background BOOLEAN DEFAULT TRUE, -- Useful for PNG icons
    link_color VARCHAR(7), -- Link color
    font_size INTEGER, -- Font size
    chat_height INTEGER, -- Chat height percentage
    external_link TEXT, -- External link

    icon_size VARCHAR(20), -- SMALL | MEDIUM | LARGE
    icon_position VARCHAR(20), -- LEFT | RIGHT
    default_mode VARCHAR(20), -- AI | AGENT | HUMAN

    watermark_brand_icon TEXT, -- Watermark icon
    watermark_brand_text TEXT, -- Watermark text
    watermark_brand_link TEXT, -- Watermark link
    watermark_brand_info_show BOOLEAN DEFAULT TRUE, -- Show watermark info
    hide_watermark_sitegpt BOOLEAN DEFAULT FALSE, -- Hide SiteGPT watermark (addon)

    right_to_left_mode BOOLEAN DEFAULT FALSE, -- RTL language support
    enable_dark_mode BOOLEAN DEFAULT FALSE, -- Dark mode toggle

    distance_from_bottom INTEGER, -- Bottom distance (px)
    horizontal_distance INTEGER, -- Horizontal distance (px)

    bot_icon_src VARCHAR(64), -- Bot icon reference
    user_icon_src VARCHAR(64), -- User icon reference
    agent_icon_src VARCHAR(64), -- Agent icon reference
    bubble_icon_src VARCHAR(64), -- Bubble icon reference

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_ui_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_behavior (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Behavior settings ID
    chatbot_id UUID UNIQUE NOT NULL, -- FK → user_chatbots.id

    hide_sources BOOLEAN DEFAULT FALSE, -- Hide sources
    hide_tooltip BOOLEAN DEFAULT FALSE, -- Hide tooltip
    hide_feedback_buttons BOOLEAN DEFAULT FALSE, -- Hide feedback buttons
    hide_bottom_navigation BOOLEAN DEFAULT FALSE, -- Hide bottom nav
    hide_refresh_button BOOLEAN DEFAULT FALSE, -- Hide refresh
    hide_expand_button BOOLEAN DEFAULT FALSE, -- Hide expand
    hide_home_page BOOLEAN DEFAULT FALSE, -- Hide home page

    stay_on_home_page BOOLEAN DEFAULT FALSE, -- Do not auto-start conversation
    require_terms_acceptance BOOLEAN DEFAULT FALSE, -- Require terms checkbox
    disclaimer_text TEXT, -- AI disclaimer text

    auto_open_chat_desktop BOOLEAN DEFAULT FALSE, -- Auto open on desktop
    auto_open_chat_desktop_delay INTEGER, -- Desktop delay (ms)

    auto_open_chat_mobile BOOLEAN DEFAULT FALSE, -- Auto open on mobile
    auto_open_chat_mobile_delay INTEGER, -- Mobile delay (ms)

    smart_follow_up_prompts_count INTEGER, -- Smart prompts count

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_behavior_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_settings_general (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- General settings ID
    chatbot_id UUID UNIQUE NOT NULL, -- FK → user_chatbots.id

    description TEXT, -- Chatbot description
    disable_smart_followup BOOLEAN DEFAULT FALSE, -- Disable smart follow-ups
    number_of_smart_followup_question_shown INTEGER, -- 1–5 questions

    enable_page_context_awareness BOOLEAN DEFAULT FALSE, -- Enable page context awareness
    history_message_context INTEGER, -- Number of history messages sent to LLM
    llm_model VARCHAR(50), -- FK → llm_models.id (only active models)

    -- disable lead settings --> already done inside the lead_settings table,

    --enterpise plan only
    limit_messages_per_conversation BOOLEAN DEFAULT FALSE, -- Enterprise-only
    max_messages_per_conversation INTEGER, -- Max messages per conversation

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_general_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

-- chatbot_settings_userData is NOT a table; requests are redirected to lead_settings table (no duplicate schema)

CREATE TABLE user_chatbot_conversation_starters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Conversation starter ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id
    
    button_title VARCHAR(255) NOT NULL, -- Button display title
    button_message TEXT NOT NULL, -- Message sent when clicked
    link_text VARCHAR(255), -- Optional link text
    link_src TEXT, -- Optional link URL
    
    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_cs_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_custom_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Prompt ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id

    title VARCHAR(255) NOT NULL, -- Prompt title
    description TEXT, -- Prompt description
    instructions TEXT NOT NULL, -- Prompt instructions
    temperature REAL, -- LLM temperature override
    deletable BOOLEAN DEFAULT FALSE, -- Whether the prompt can be deleted
    creativity_level REAL, -- LLM creativity level override

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_custom_prompt_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_follow_up_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Follow-up prompt ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id

    button_title VARCHAR(255), -- Button title (button-type follow-up)
    button_message TEXT, -- Button message payload
    link_text VARCHAR(255), -- Link text (link-type follow-up)
    link_src TEXT, -- Link URL (link-type follow-up)

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_fup_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_settings_instruction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Instruction settings ID
    chatbot_id UUID UNIQUE NOT NULL, -- FK → user_chatbots.id

    title VARCHAR(100), -- Instruction title
    instruction TEXT NOT NULL, -- System instruction text
    creativity_level REAL NOT NULL DEFAULT 0.5, -- LLM temperature
    deletable BOOLEAN DEFAULT FALSE, -- Whether the instruction can be deleted

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_instruction_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Persona ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id

    title VARCHAR(50) NOT NULL, -- Persona title
    description TEXT, -- Persona description
    instructions TEXT NOT NULL, -- Persona instructions
    creativity_level REAL NOT NULL DEFAULT 0.5, -- LLM temperature
    deletable BOOLEAN NOT NULL DEFAULT FALSE, -- False for default personas

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_persona_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_settings_localization_texts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Localization record ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id (customer owning localization)
    locale_code VARCHAR(5) NOT NULL, -- Locale code (en, hi, fr, etc.)

    home_title TEXT, -- Home title text
    home_description TEXT, -- Home description text
    add_details TEXT, -- Add details label
    start_conversation TEXT, -- Start conversation label
    starting TEXT, -- Starting text

    messages_title TEXT, -- Messages title
    messages_description TEXT, -- Messages description
    no_messages TEXT, -- No messages text
    verify_email_message TEXT, -- Verify email message
    conversation_history_info TEXT, -- Conversation history info

    bot_label TEXT, -- Bot label
    you_label TEXT, -- User label
    agent_label TEXT, -- Agent label
    escalate_confirmation TEXT, -- Escalation confirmation text
    escalate_description TEXT, -- Escalation description
    yes_continue TEXT, -- Yes / continue button text
    cancel TEXT, -- Cancel text
    switched_to_human TEXT, -- Switched to human message
    start_new_conversation TEXT, -- Start new conversation text
    max_messages_title TEXT, -- Max messages title
    max_messages_description TEXT, -- Max messages description

    connected TEXT, -- Connected status
    disconnected TEXT, -- Disconnected status
    connecting TEXT, -- Connecting status
    disconnecting TEXT, -- Disconnecting status
    reconnect TEXT, -- Reconnect text

    account_title TEXT, -- Account title
    verify_email_title TEXT, -- Verify email title
    verify_email_description TEXT, -- Verify email description
    email_label TEXT, -- Email label
    name_label TEXT, -- Name label
    phone_label TEXT, -- Phone label
    submit_button TEXT, -- Submit button text
    sending_otp TEXT, -- Sending OTP text
    verify_otp TEXT, -- Verify OTP text
    otp_sent_message TEXT, -- OTP sent message
    otp_label TEXT, -- OTP label
    verify_continue TEXT, -- Verify continue button
    resend_otp TEXT, -- Resend OTP text
    edit_details TEXT, -- Edit details text
    resetting TEXT, -- Resetting text
    verifying TEXT, -- Verifying text
    logout TEXT, -- Logout text
    logging_out TEXT, -- Logging out text
    verified TEXT, -- Verified text
    edit TEXT, -- Edit text
    update TEXT, -- Update text
    updating TEXT, -- Updating text

    lead_form_title TEXT, -- Lead form title
    lead_form_description TEXT, -- Lead form description
    form_heading TEXT, -- Form heading
    form_submitted_message TEXT, -- Form submitted message
    continue_button TEXT, -- Continue button text
    submitting_text TEXT, -- Submitting text
    input_disabled_placeholder TEXT, -- Disabled input placeholder

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_chatbot_integration
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE
);

CREATE TABLE user_chatbot_leads_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Lead settings ID
    enable_lead_collection BOOLEAN DEFAULT FALSE, -- Enable lead collection

    customer_name_take BOOLEAN DEFAULT FALSE, -- Ask for customer name
    customer_name TEXT, -- Customer name value
    customer_phone_take BOOLEAN DEFAULT FALSE, -- Ask for customer phone
    customer_phone TEXT, -- Customer phone value
    customer_email_take BOOLEAN NOT NULL DEFAULT TRUE, -- Ask for customer email (always true)
    customer_email TEXT, -- Customer email value

    industry_template TEXT, -- Industry template selection

    when_to_collect_lead TEXT, -- Trigger: user interest | unable to answer | after N messages
    
    customer_trigger_keywords TEXT, -- Custom keywords to trigger lead capture

    customer_form_field JSONB, -- Custom form fields {display_label, field_name, field_type, required, placeholder_text}

    booking_integration BOOLEAN DEFAULT FALSE, -- Enable booking integration
    booking_integration_link TEXT, -- Booking integration URL

    lead_notification BOOLEAN DEFAULT FALSE, -- Enable lead capture email notifications
    lead_notification_email TEXT[], -- Notification email recipients

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    -- Combined Constraint
    CONSTRAINT chk_when_to_collect_lead 
    CHECK (when_to_collect_lead IS NULL OR when_to_collect_lead IN ('interest','unable_to_answer','after_n_messages')),

    constraint fk_lead_settings_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE
);

CREATE TABLE user_chatbot_human_support_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Human support settings ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id

    enable_human_support BOOLEAN DEFAULT FALSE, -- Enable human support

    replace_all_other_suggestions_with_escalation_buttons BOOLEAN DEFAULT FALSE, -- Replace all suggestions with escalation buttons
    positive_feedback_prompt TEXT, -- Positive feedback prompt text
    request_human_support_prompt TEXT, -- Request human support prompt text
    human_support_confirmation_message TEXT, -- Confirmation message shown to user

    lead_notification BOOLEAN DEFAULT FALSE, -- Enable escalation email notifications
    lead_notification_email TEXT[], -- Notification email recipients

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_human_support_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Integration ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id
    platform_type VARCHAR(30) NOT NULL, -- SLACK | MESSENGER | CRISP | ZOHO_SALES_IQ
    config JSONB NOT NULL, -- Platform-specific tokens / secrets
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Enable / disable integration

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_integration_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE, -- Cascade on chatbot delete

    CONSTRAINT chk_platform_type
        CHECK (platform_type IN ('SLACK','MESSENGER','CRISP','ZOHO_SALES_IQ')) -- Enforce supported platforms
);
CREATE INDEX idx_integrations_platform ON user_chatbot_integrations(chatbot_id, platform_type) WHERE is_enabled = TRUE;

CREATE TABLE user_chatbot_chatting_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Chat customer ID

    email VARCHAR(255), -- Customer email
    name VARCHAR(255), -- Customer name
    phone_number VARCHAR(50), -- Customer phone number

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now() -- Updated at
);

CREATE TABLE user_chatbot_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Thread ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id
    anonymous BOOLEAN DEFAULT TRUE, -- Anonymous until user shares details
    chat_user_id UUID, -- FK → user_chatbot_chatting_customers.id (nullable until lead captured)
    mode VARCHAR(20) NOT NULL, -- AI | AGENT | HUMAN
    unread_messages_count INTEGER NOT NULL DEFAULT 0, -- Unread messages for agents

    webhook_url TEXT, -- Webhook URL
    webhook_token TEXT, -- Webhook auth token

    escalated BOOLEAN NOT NULL DEFAULT FALSE, -- Escalation flag
    important BOOLEAN NOT NULL DEFAULT FALSE, -- Marked important
    resolved BOOLEAN NOT NULL DEFAULT FALSE, -- Resolved flag
    archived BOOLEAN NOT NULL DEFAULT FALSE, -- Archived flag

    tags JSONB, -- Thread tags
    positive_count INTEGER NOT NULL DEFAULT 0, -- Positive feedback count
    negative_count INTEGER NOT NULL DEFAULT 0, -- Negative feedback count

    started_at TIMESTAMP NOT NULL DEFAULT now(), -- Conversation start time
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Last update time
    ended_at TIMESTAMP, -- Conversation end time

    CONSTRAINT fk_thread_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE, -- Cascade on chatbot delete

    CONSTRAINT fk_thread_customer
        FOREIGN KEY (chat_user_id) REFERENCES user_chatbot_chatting_customers(id) ON DELETE SET NULL -- Preserve thread if customer deleted
);


-- for every msg from llm to user, update the same in the llm_model_usage table
CREATE TABLE user_chatbot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Message ID
    thread_id UUID NOT NULL, -- FK → user_chatbot_threads.id
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id

    message_type VARCHAR(50), -- NORMAL_MESSAGE | USER_MESSAGE | AGENT_MESSAGE
    system_message_type VARCHAR(50), -- CONVERSATION_ESCALATED, etc.

    content TEXT NOT NULL, -- Message content
    content_timestamp TIMESTAMP NOT NULL DEFAULT now(), -- Message time

    role VARCHAR(20) NOT NULL, -- USER | ASSISTANT | AGENT | SYSTEM
    agent_name VARCHAR(50), -- Agent name (if agent message)
    parent_message_id UUID, -- Parent message for tool / chain calls
    llm_model_id UUID, -- FK → llm_models.id
    reaction VARCHAR(20), -- POSITIVE | NEGATIVE | NEUTRAL
    source VARCHAR(50), -- FACEBOOK | INSTAGRAM | WEB | API

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_message_llm_model
        FOREIGN KEY (llm_model_id) REFERENCES website_llm_models(id) ON DELETE CASCADE, -- Cascade on llm model delete

    CONSTRAINT fk_message_thread
        FOREIGN KEY (thread_id) REFERENCES user_chatbot_threads(id) ON DELETE CASCADE, -- Cascade on thread delete

    CONSTRAINT fk_message_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE -- Cascade on chatbot delete
);

CREATE TABLE user_chatbot_retrieval_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID NOT NULL,
    thread_id UUID,          -- Can be NULL if search is via API/Test
    message_id UUID,         -- The user message that triggered the search

    query_text TEXT NOT NULL, -- The rewritten or original query sent to vector DB
    vector_filter JSONB,      -- Metadata filters used (e.g., {"file_id": "..."})
    
    top_k INTEGER DEFAULT 5,  -- Number of chunks requested
    score_threshold REAL,     -- Minimum similarity score
    
    results_count INTEGER DEFAULT 0,
    latency_ms INTEGER,       -- Performance tracking

    created_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_retrieval_chatbot 
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE,
    CONSTRAINT fk_retrieval_thread 
        FOREIGN KEY (thread_id) REFERENCES user_chatbot_threads(id) ON DELETE CASCADE
);
CREATE INDEX idx_retrieval_run_chatbot ON retrieval_runs(chatbot_id);
CREATE INDEX idx_retrieval_run_thread ON retrieval_runs(thread_id);

CREATE TABLE user_chatbot_system_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    service VARCHAR(20) NOT NULL, -- INGESTION | RETRIEVAL | GENERATION | API | BILLING
    error_stage VARCHAR(20) NOT NULL, -- UPLOAD | CHUNKING | VECTOR_SEARCH | LLM_CALL
    severity VARCHAR(20) NOT NULL, -- INFO | WARN | ERROR | CRITICAL

    user_id UUID NOT NULL, 
    chatbot_id UUID NOT NULL, 
    thread_id UUID, 
    message_id UUID, 
    file_id UUID, 
    chunk_id UUID, 
    retrieval_run_id UUID, -- Link to the search attempt that failed

    error_code VARCHAR(20), 
    error_message TEXT NOT NULL, 

    retryable BOOLEAN NOT NULL DEFAULT FALSE, 
    resolved BOOLEAN NOT NULL DEFAULT FALSE, 
    resolved_at TIMESTAMP, 

    metadata JSONB, -- Store stack traces or raw provider errors

    created_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_error_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_chatbot 
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_thread 
        FOREIGN KEY (thread_id) REFERENCES user_chatbot_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_message 
        FOREIGN KEY (message_id) REFERENCES user_chatbot_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_file 
        FOREIGN KEY (file_id) REFERENCES ingestion_files(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_chunk 
        FOREIGN KEY (chunk_id) REFERENCES ingestion_chunks(id) ON DELETE CASCADE,
    CONSTRAINT fk_error_retrieval 
        FOREIGN KEY (retrieval_run_id) REFERENCES retrieval_runs(id) ON DELETE CASCADE
);


--===================================================================================
--Ingestion

/*
 Vectorize namespace strategy:
 - Default: user_chatbots.vector_namespace (e.g. 'bot_' || id::text)
 - When re-embedding needed (new model, chunk size change, etc.):
   1. Increment user_chatbots.vector_index_version
   2. Set new namespace = 'bot_' || id::text || ':v' || vector_index_version
   3. Queue purge for old namespace
   4. Re-ingest → new vectors land in new namespace
 → Query-time: always use current user_chatbots.vector_namespace
*/

CREATE TABLE vector_purge_requests (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id  UUID NOT NULL,
    file_id     UUID,               -- NULL = whole chatbot
    namespace   TEXT,
    status      VARCHAR(20) DEFAULT 'PENDING',
    created_at  TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP,
    error       TEXT
);

CREATE TABLE ingestion_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Ingestion file ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id
    user_id UUID NOT NULL, -- FK → users.id

    ingestion_firecrawl_batch_jobs_id UUID , -- FK → ingestion_firecrawl_batch_jobs.id

    file_name VARCHAR(255) NOT NULL, -- Original file name
    file_type VARCHAR(50) NOT NULL, -- PDF | DOCX | TXT
    file_size INTEGER NOT NULL, -- File size in bytes
    file_tokens INTEGER, -- Total tokens in file
    file_pages INTEGER, -- Total pages in file

    origin VARCHAR(20) NOT NULL, -- FILE | WEB | YOUTUBE
    file_source VARCHAR(50) NOT NULL, -- LOCAL_UPLOAD | NOTION | GDRIVE | DROPBOX | ONEDRIVE | GITHUB | BOX

    source_id UUID, -- FK → ingestion_sources.id (optional: if uploaded YOUTUBE, Website, Notion, GDrive, OneDrive, GitHub, Box)

    storage_uri TEXT NOT NULL, -- S3 storage URI
    object_key TEXT NOT NULL, -- path of file in object storage
    total_chunks INTEGER NOT NULL DEFAULT 0, -- Total chunks generated
    status VARCHAR(20) NOT NULL, -- UPLOADED | CHUNKING | EMBEDDING | COMPLETED | FAILED

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_ingestion_firecrawl_batch_jobs
        FOREIGN KEY (ingestion_firecrawl_batch_jobs_id) REFERENCES ingestion_firecrawl_batch_jobs(id) ON DELETE CASCADE,

    CONSTRAINT fk_ingestion_file_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE, -- Cascade on chatbot delete

    CONSTRAINT fk_ingestion_file_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Cascade on user delete
);
-- CREATE INDEX idx_ingestion_files_file_id ON ingestion_files(file_id);

CREATE TABLE ingestion_firecrawl_batch_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID NOT NULL,
    user_id UUID NOT NULL,
    job_id TEXT NOT NULL,
    job_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,

    total_urls INTEGER NOT NULL DEFAULT 0,
    processed_urls INTEGER NOT NULL DEFAULT 0,
    successful_urls INTEGER NOT NULL DEFAULT 0,
    failed_urls INTEGER NOT NULL DEFAULT 0,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_ingestion_firecrawl_batch_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE, -- Cascade on chatbot delete

    CONSTRAINT fk_ingestion_firecrawl_batch_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Cascade on user delete
);

CREATE TABLE ingestion_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Chunk ID
    file_id UUID NOT NULL, -- FK → ingestion_files.id

    chunk_index INTEGER NOT NULL, -- Chunk order within file
    object_key TEXT NOT NULL, -- path of chunk in object storage
    chunk_text_preview_link TEXT, -- Optional preview link

    token_count INTEGER NOT NULL, -- Tokens including overlap (e.g., 512/1024)

    embedding_status VARCHAR(20) NOT NULL, -- PENDING | COMPLETED | FAILED

    vector_id TEXT,              -- ID used in Vectorize
    vector_namespace TEXT,       -- e.g. chatbot_id or chatbot_id:file_id
    vector_metadata JSONB,       -- Metadata used in Vectorize

    --     {
    --   "chatbot_id": "...",
    --   "file_id": "...",
    --   "source_type": "YOUTUBE",
    --   "chunk_index": 12,
    --   "language": "en"
    --     }

    page_number INTEGER; -- use full for citation of page number

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_ingestion_chunk_file
        FOREIGN KEY (file_id) REFERENCES ingestion_files(id) ON DELETE CASCADE, -- Cascade on file delete

    CONSTRAINT uq_file_chunk_index
        UNIQUE (file_id, chunk_index) -- Prevent duplicate chunk ordering
);
--  CREATE INDEX idx_ingestion_chunks_file_id ON ingestion_chunks(file_id);

-- All input like website, sitemap, youtube, etc. will be come here, and stored inside ingestion_files table
CREATE TABLE ingestion_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Ingestion source ID
    chatbot_id UUID NOT NULL, -- FK → user_chatbots.id
    file_id UUID, -- FK → ingestion_files.id (nullable for multi-page sources)
    source_type VARCHAR(30) NOT NULL, -- UPLOAD | WEBSITE | SITEMAP | YOUTUBE

    source_url TEXT NOT NULL, -- Original source URL
    normalized_url TEXT, -- Canonical URL after redirects / normalization

    extractor VARCHAR(50) NOT NULL, -- firecrawl | jina | browserless | youtube_api

    extraction_status VARCHAR(20) NOT NULL, -- PENDING | FETCHING | CONVERTING | COMPLETED | FAILED

    extracted_pages INTEGER, -- Total pages extracted
    extracted_tokens INTEGER, -- Total tokens extracted

    metadata JSONB, -- Crawl depth, language, sitemap count, video duration, channel info, etc.

    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Created at
    updated_at TIMESTAMP NOT NULL DEFAULT now(), -- Updated at

    CONSTRAINT fk_ingestion_source_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE, -- Cascade on chatbot delete

    CONSTRAINT fk_ingestion_source_file
        FOREIGN KEY (file_id) REFERENCES ingestion_files(id) ON DELETE SET NULL -- Preserve source even if file deleted
);

CREATE TABLE ingestion_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    chatbot_id UUID NOT NULL,
    file_id UUID,        -- ✅ MISSING
    chunk_id UUID,       -- ✅ MISSING

    step VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    resolved_at TIMESTAMP,

    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_ingestion_error_chatbot
        FOREIGN KEY (chatbot_id)
        REFERENCES user_chatbots(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ingestion_error_file
        FOREIGN KEY (file_id)
        REFERENCES ingestion_files(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ingestion_error_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES ingestion_chunks(id)
        ON DELETE CASCADE
);




-- CREATE INDEX idx_ingestion_errors ON ingestion_errors(chatbot_id);

CREATE TABLE ingestion_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    chatbot_id UUID NOT NULL,                 -- FK → user_chatbots.id
    entity_type VARCHAR(20) NOT NULL,         -- FILE | CHUNK | SOURCE

    file_id UUID,
    chunk_id UUID,
    source_id UUID,

    status VARCHAR(50) NOT NULL,              -- UPLOADED | CHUNKING | EMBEDDING | COMPLETED | FAILED | DELETING | DELETED
    metadata JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_ingestion_status_chatbot
        FOREIGN KEY (chatbot_id)
        REFERENCES user_chatbots(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ingestion_status_file
        FOREIGN KEY (file_id)
        REFERENCES ingestion_files(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ingestion_status_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES ingestion_chunks(id)
        ON DELETE CASCADE,

    -- if/when you add ingestion_sources
    -- CONSTRAINT fk_ingestion_status_source
    --     FOREIGN KEY (source_id)
    --     REFERENCES ingestion_sources(id)
    --     ON DELETE CASCADE,

    CONSTRAINT chk_exactly_one_entity
        CHECK (
            (entity_type = 'FILE'  AND file_id  IS NOT NULL AND chunk_id IS NULL AND source_id IS NULL)
         OR (entity_type = 'CHUNK' AND chunk_id IS NOT NULL AND file_id  IS NULL AND source_id IS NULL)
         OR (entity_type = 'SOURCE' AND source_id IS NOT NULL AND file_id IS NULL AND chunk_id IS NULL)
        )
);
-- CREATE INDEX idx_ingestion_status_chatbot ON ingestion_status_logs(chatbot_id);




--===================================================================================
-- Widget Configuration and Session Tracking

-- Widget configuration table for chatbot embedding
CREATE TABLE chatbot_widget_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID UNIQUE NOT NULL,

    -- Domain security
    allowed_domains TEXT[], -- ['example.com', 'app.example.com']
    widget_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    widget_version VARCHAR(10) DEFAULT 'v1',

    -- Widget behavior
    log_conversations BOOLEAN NOT NULL DEFAULT TRUE, -- GDPR compliance
    enable_analytics BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_widget_config_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE
);
CREATE INDEX idx_widget_config_chatbot ON chatbot_widget_config(chatbot_id);

-- Widget session tracking for analytics and abuse prevention
CREATE TABLE chatbot_widget_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID NOT NULL,

    session_id VARCHAR(64) NOT NULL, -- Generated client-side
    origin_domain TEXT,
    user_agent TEXT,
    ip_address INET,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ,
    messages_count INTEGER DEFAULT 0,

    -- Session metadata
    metadata JSONB, -- Browser info, screen size, etc.

    CONSTRAINT fk_widget_session_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE
);
CREATE INDEX idx_widget_sessions_chatbot ON chatbot_widget_sessions(chatbot_id);
CREATE INDEX idx_widget_sessions_session_id ON chatbot_widget_sessions(session_id);
CREATE INDEX idx_widget_sessions_started_at ON chatbot_widget_sessions(started_at);

-- Widget interaction logs (for rate limiting and analytics)
CREATE TABLE chatbot_widget_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID NOT NULL,
    session_id UUID,

    interaction_type VARCHAR(30) NOT NULL, -- QUERY | FEEDBACK | LOAD | ERROR

    -- Request details
    query_text TEXT,
    response_text TEXT,
    llm_model_used VARCHAR(50),

    -- Performance metrics
    response_time_ms INTEGER,
    tokens_used INTEGER,

    -- Error tracking
    error_occurred BOOLEAN DEFAULT FALSE,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_widget_interaction_chatbot
        FOREIGN KEY (chatbot_id) REFERENCES user_chatbots(id) ON DELETE CASCADE,
    CONSTRAINT fk_widget_interaction_session
        FOREIGN KEY (session_id) REFERENCES chatbot_widget_sessions(id) ON DELETE SET NULL
);
CREATE INDEX idx_widget_interactions_chatbot ON chatbot_widget_interactions(chatbot_id);
CREATE INDEX idx_widget_interactions_session ON chatbot_widget_interactions(session_id);
CREATE INDEX idx_widget_interactions_created_at ON chatbot_widget_interactions(created_at);
