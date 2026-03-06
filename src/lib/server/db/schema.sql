-- Profilarr Database Schema
-- This file documents the current database schema after all migrations
-- DO NOT execute this file directly - use migrations instead
-- Last updated: 2026-02-20

-- ==============================================================================
-- TABLE: migrations
-- Purpose: Track applied database migrations
-- Managed by: MigrationRunner (src/db/migrations.ts)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: arr_instances
-- Purpose: Store configuration for *arr application instances (Radarr, Sonarr, etc.)
-- Migration: 001_create_arr_instances.ts, 053_add_library_refresh_to_arr_instances.ts
-- ==============================================================================

CREATE TABLE arr_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Instance identification
    name TEXT NOT NULL UNIQUE,              -- User-friendly name (e.g., "Main Radarr", "4K Sonarr")
    type TEXT NOT NULL,                     -- Instance type: radarr, sonarr, readarr, lidarr, prowlarr

    -- Connection details
    url TEXT NOT NULL,                      -- Base URL (e.g., "http://localhost:7878")
    api_key TEXT NOT NULL,                  -- API key for authentication

    -- Configuration
    tags TEXT,                              -- JSON array of tags (e.g., '["movies","4k"]')
    enabled INTEGER NOT NULL DEFAULT 1,     -- 1=enabled, 0=disabled

    -- Library refresh (Migration 053)
    library_refresh_interval INTEGER NOT NULL DEFAULT 0, -- 0=manual, >0=auto-refresh every X minutes
    library_last_refreshed_at TEXT,         -- When library cache was last refreshed

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: log_settings
-- Purpose: Store configurable logging settings (singleton pattern with id=1)
-- Migration: 003_create_log_settings.ts, 006_simplify_log_settings.ts, 019_default_log_level_debug.ts
-- ==============================================================================

CREATE TABLE log_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- Retention
    retention_days INTEGER NOT NULL DEFAULT 30,

    -- Log Level (default changed to DEBUG in migration 019)
    min_level TEXT NOT NULL DEFAULT 'DEBUG' CHECK (min_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),

    -- Enable/Disable
    enabled INTEGER NOT NULL DEFAULT 1,
    file_logging INTEGER NOT NULL DEFAULT 1,
    console_logging INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: jobs
-- Purpose: Store job definitions and schedules
-- Migration: 004_create_jobs_tables.ts
-- ==============================================================================

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Job identification
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Scheduling
    schedule TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,

    -- Execution tracking
    last_run_at DATETIME,
    next_run_at DATETIME,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: job_runs
-- Purpose: Store execution history for each job
-- Migration: 004_create_jobs_tables.ts, 035_add_job_skipped_status.ts
-- ==============================================================================

CREATE TABLE job_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to jobs
    job_id INTEGER NOT NULL,

    -- Execution status (skipped = job ran but had nothing to do)
    status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),

    -- Timing
    started_at DATETIME NOT NULL,
    finished_at DATETIME NOT NULL,
    duration_ms INTEGER NOT NULL,

    -- Output
    error TEXT,
    output TEXT,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- ==============================================================================
-- TABLE: job_queue
-- Purpose: Store scheduled and manual job instances
-- Migration: 049_create_job_queue.ts
-- ==============================================================================

CREATE TABLE job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    run_at TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    source TEXT NOT NULL DEFAULT 'system',
    dedupe_key TEXT,
    cooldown_until TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: job_run_history
-- Purpose: Store execution history for job instances
-- Migration: 049_create_job_queue.ts
-- ==============================================================================

CREATE TABLE job_run_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    error TEXT,
    output TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES job_queue(id) ON DELETE SET NULL
);

-- ==============================================================================
-- TABLE: backup_settings
-- Purpose: Store configurable backup settings (singleton pattern with id=1)
-- Migration: 005_create_backup_settings.ts
-- ==============================================================================

CREATE TABLE backup_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- Backup Configuration
    schedule TEXT NOT NULL DEFAULT 'daily',
    retention_days INTEGER NOT NULL DEFAULT 30,
    enabled INTEGER NOT NULL DEFAULT 1,
    include_database INTEGER NOT NULL DEFAULT 1,
    compression_enabled INTEGER NOT NULL DEFAULT 1,  -- UNUSED: stored but not read by backup logic

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: notification_services
-- Purpose: Store notification service configurations (Discord, Slack, Email, etc.)
-- Migration: 007_create_notification_tables.ts
-- ==============================================================================

CREATE TABLE notification_services (
    id TEXT PRIMARY KEY,                        -- UUID

    -- Service identification
    name TEXT NOT NULL,                         -- User-defined: "Main Discord", "Error Alerts"
    service_type TEXT NOT NULL,                 -- 'discord', 'slack', 'email', etc.

    -- Configuration
    enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch
    config TEXT NOT NULL,                       -- JSON blob: { webhook_url: "...", username: "...", ... }
    enabled_types TEXT NOT NULL,                -- JSON array: ["job.backup.success", "job.backup.failed"]

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: notification_history
-- Purpose: Track notification delivery history for auditing and debugging
-- Migration: 007_create_notification_tables.ts
-- ==============================================================================

CREATE TABLE notification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to notification service
    service_id TEXT NOT NULL,

    -- Notification details
    notification_type TEXT NOT NULL,            -- e.g., 'job.backup.success'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT,                              -- JSON blob for additional context

    -- Delivery status
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error TEXT,                                 -- Error message if status = 'failed'

    -- Timing
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (service_id) REFERENCES notification_services(id) ON DELETE CASCADE
);

-- ==============================================================================
-- TABLE: database_instances
-- Purpose: Store linked Profilarr Compliant Database (PCD) repositories
-- Migration: 008_create_database_instances.ts, 009_add_personal_access_token.ts, 010_add_is_private.ts, 040_add_local_ops_enabled.ts, 043_add_git_identity_to_database_instances.ts, 044_add_conflict_strategy_to_database_instances.ts
-- ==============================================================================

CREATE TABLE database_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Instance identification
    uuid TEXT NOT NULL UNIQUE,                  -- UUID for filesystem storage path
    name TEXT NOT NULL UNIQUE,                  -- User-friendly name (e.g., "Dictionarry DB")

    -- Repository connection
    repository_url TEXT NOT NULL,               -- Git repository URL
    personal_access_token TEXT,                 -- PAT for private repos and push access (Migration 009)
    is_private INTEGER NOT NULL DEFAULT 0,      -- 1=private repo, 0=public (auto-detected, Migration 010)
    local_ops_enabled INTEGER NOT NULL DEFAULT 0, -- 1=force local ops even with PAT (Migration 040)
    git_user_name TEXT,                         -- Git commit author name (Migration 043)
    git_user_email TEXT,                        -- Git commit author email (Migration 043)
    conflict_strategy TEXT NOT NULL DEFAULT 'override' CHECK (
        conflict_strategy IN ('override', 'align', 'ask')
    ),                                          -- Default conflict handling strategy (Migration 044)

    -- Local storage
    local_path TEXT NOT NULL,                   -- Path where repo is cloned (data/databases/{uuid})

    -- Sync settings
    sync_strategy INTEGER NOT NULL DEFAULT 0,   -- 0=manual check, >0=auto-check every X minutes
    auto_pull INTEGER NOT NULL DEFAULT 0,       -- 0=notify only, 1=auto-pull updates

    -- Status
    enabled INTEGER NOT NULL DEFAULT 1,         -- 1=enabled, 0=disabled
    last_synced_at DATETIME,                    -- Timestamp of last successful sync

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: upgrade_configs
-- Purpose: Store upgrade configuration per arr instance for automated quality upgrades
-- Migration: 011_create_upgrade_configs.ts, 012_add_upgrade_last_run.ts, 013_add_upgrade_dry_run.ts, 051_cron_scheduling.ts
-- ==============================================================================

CREATE TABLE upgrade_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Relationship (one config per arr instance)
    arr_instance_id INTEGER NOT NULL UNIQUE,

    -- Core settings
    enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch
    dry_run INTEGER NOT NULL DEFAULT 0,         -- 1=dry run mode, 0=normal (Migration 013)
    cron TEXT NOT NULL DEFAULT '0 */6 * * *',   -- Cron expression (Migration 051, replaced schedule)
    filter_mode TEXT NOT NULL DEFAULT 'round_robin', -- 'round_robin' or 'random'

    -- Filters (stored as JSON array of FilterConfig objects)
    filters TEXT NOT NULL DEFAULT '[]',

    -- State tracking
    current_filter_index INTEGER NOT NULL DEFAULT 0, -- For round-robin mode
    last_run_at DATETIME,                            -- When upgrade job last ran (Migration 012)
    next_run_at TEXT,                                -- Next scheduled run (Migration 051)

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- ==============================================================================
-- TABLE: pcd_ops
-- Purpose: Store PCD operations (base + user) in the local database
-- Migration: 041_create_pcd_ops.ts
-- ==============================================================================

CREATE TABLE pcd_ops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('base', 'user')),
    state TEXT NOT NULL CHECK (state IN ('published', 'draft', 'superseded', 'dropped', 'orphaned')),
    source TEXT NOT NULL CHECK (source IN ('repo', 'local', 'import')),
    filename TEXT,
    op_number INTEGER,
    sequence INTEGER,
    sql TEXT NOT NULL,
    metadata TEXT,
    desired_state TEXT,
    content_hash TEXT,
    last_seen_in_repo_at DATETIME,
    superseded_by_op_id INTEGER,
    pushed_at DATETIME,
    pushed_commit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (superseded_by_op_id) REFERENCES pcd_ops(id)
);

CREATE INDEX idx_pcd_ops_apply_order
    ON pcd_ops(database_id, origin, state, sequence, id);

CREATE UNIQUE INDEX idx_pcd_ops_base_filename
    ON pcd_ops(database_id, origin, filename)
    WHERE origin = 'base' AND filename IS NOT NULL;

CREATE INDEX idx_pcd_ops_hash
    ON pcd_ops(database_id, origin, content_hash);

-- ==============================================================================
-- TABLE: pcd_op_history
-- Purpose: Track per-op apply status and conflicts
-- Migration: 042_create_pcd_op_history.ts
-- ==============================================================================

CREATE TABLE pcd_op_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id INTEGER NOT NULL,
    database_id INTEGER NOT NULL,
    batch_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('applied', 'skipped', 'conflicted', 'conflicted_pending', 'error', 'dropped', 'superseded')
    ),
    rowcount INTEGER,
    conflict_reason TEXT,
    error TEXT,
    details TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (op_id) REFERENCES pcd_ops(id) ON DELETE CASCADE,
    FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_pcd_op_history_status
    ON pcd_op_history(database_id, status, applied_at);

CREATE INDEX idx_pcd_op_history_op
    ON pcd_op_history(op_id, applied_at);

-- ==============================================================================
-- TABLE: ai_settings
-- Purpose: Store AI/LLM configuration for commit message generation
-- Migration: 014_create_ai_settings.ts
-- ==============================================================================

CREATE TABLE ai_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- Provider settings
    provider TEXT NOT NULL DEFAULT 'openai',    -- 'openai', 'anthropic', etc.
    api_key TEXT,                               -- Encrypted API key
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',  -- Model identifier

    -- Feature flags
    enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: arr_sync_quality_profiles
-- Purpose: Store quality profile sync selections (many-to-many)
-- Migration: 015_create_arr_sync_tables.ts, 029_add_database_id_foreign_keys.ts
-- ==============================================================================

CREATE TABLE arr_sync_quality_profiles (
    instance_id INTEGER NOT NULL,
    database_id INTEGER NOT NULL,
    profile_name TEXT NOT NULL,
    PRIMARY KEY (instance_id, database_id, profile_name),
    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
);

-- ==============================================================================
-- TABLE: arr_sync_quality_profiles_config
-- Purpose: Store quality profile sync trigger configuration (one per instance)
-- Migration: 015_create_arr_sync_tables.ts, 016_add_should_sync_flags.ts, 034_add_sync_status.ts
-- ==============================================================================

CREATE TABLE arr_sync_quality_profiles_config (
    instance_id INTEGER PRIMARY KEY,
    trigger TEXT NOT NULL DEFAULT 'none',       -- 'none', 'manual', 'on_pull', 'on_change', 'schedule'
    cron TEXT,                                  -- Cron expression for schedule trigger
    should_sync INTEGER NOT NULL DEFAULT 0,     -- Flag for pending sync (Migration 016) - deprecated
    next_run_at TEXT,                           -- Next scheduled run timestamp (Migration 022)
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- Status: idle, pending, in_progress, failed (Migration 034)
    last_error TEXT,                            -- Last sync error message (Migration 034)
    last_synced_at TEXT,                        -- Last successful sync timestamp (Migration 034)
    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- ==============================================================================
-- TABLE: arr_sync_delay_profiles_config
-- Purpose: Store delay profile sync configuration (one per instance, single profile)
-- Migration: 015_create_arr_sync_tables.ts, 016_add_should_sync_flags.ts, 028_simplify_delay_profile_sync.ts, 029_add_database_id_foreign_keys.ts, 034_add_sync_status.ts
-- ==============================================================================

CREATE TABLE arr_sync_delay_profiles_config (
    instance_id INTEGER PRIMARY KEY,
    trigger TEXT NOT NULL DEFAULT 'none',       -- 'none', 'manual', 'on_pull', 'on_change', 'schedule'
    cron TEXT,                                  -- Cron expression for schedule trigger
    should_sync INTEGER NOT NULL DEFAULT 0,     -- Flag for pending sync (Migration 016) - deprecated
    next_run_at TEXT,                           -- Next scheduled run timestamp (Migration 022)
    database_id INTEGER,                        -- Single database reference (Migration 028)
    profile_id INTEGER,                         -- Single profile reference (Migration 028)
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- Status: idle, pending, in_progress, failed (Migration 034)
    last_error TEXT,                            -- Last sync error message (Migration 034)
    last_synced_at TEXT,                        -- Last successful sync timestamp (Migration 034)
    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE SET NULL
);

-- ==============================================================================
-- TABLE: arr_sync_media_management
-- Purpose: Store media management sync configuration (one per instance)
-- Migration: 015_create_arr_sync_tables.ts, 016_add_should_sync_flags.ts, 029_add_database_id_foreign_keys.ts, 034_add_sync_status.ts, 038_add_media_management_config_names.ts
-- ==============================================================================

CREATE TABLE arr_sync_media_management (
    instance_id INTEGER PRIMARY KEY,
    naming_database_id INTEGER,                 -- Database to use for naming settings
    naming_config_name TEXT,                    -- Name of the naming config to sync (Migration 038)
    quality_definitions_database_id INTEGER,    -- Database to use for quality definitions
    quality_definitions_config_name TEXT,       -- Name of the quality definitions config to sync (Migration 038)
    media_settings_database_id INTEGER,         -- Database to use for media settings
    media_settings_config_name TEXT,            -- Name of the media settings config to sync (Migration 038)
    trigger TEXT NOT NULL DEFAULT 'none',       -- 'none', 'manual', 'on_pull', 'on_change', 'schedule'
    cron TEXT,                                  -- Cron expression for schedule trigger
    should_sync INTEGER NOT NULL DEFAULT 0,     -- Flag for pending sync (Migration 016) - deprecated
    next_run_at TEXT,                           -- Next scheduled run timestamp (Migration 022)
    sync_status TEXT NOT NULL DEFAULT 'idle',   -- Status: idle, pending, in_progress, failed (Migration 034)
    last_error TEXT,                            -- Last sync error message (Migration 034)
    last_synced_at TEXT,                        -- Last successful sync timestamp (Migration 034)
    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (naming_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
    FOREIGN KEY (quality_definitions_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
    FOREIGN KEY (media_settings_database_id) REFERENCES database_instances(id) ON DELETE SET NULL
);

-- ==============================================================================
-- INDEXES
-- Purpose: Improve query performance
-- ==============================================================================

-- Jobs indexes (Migration: 004_create_jobs_tables.ts)
CREATE INDEX idx_jobs_enabled ON jobs(enabled);
CREATE INDEX idx_jobs_next_run ON jobs(next_run_at);

-- Job runs indexes (Migration: 004_create_jobs_tables.ts, 035_add_job_skipped_status.ts)
CREATE INDEX idx_job_runs_job_id ON job_runs(job_id);
CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);
CREATE INDEX idx_job_runs_status ON job_runs(status);

-- Job queue indexes (Migration: 049_create_job_queue.ts)
CREATE UNIQUE INDEX idx_job_queue_dedupe_key ON job_queue(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_job_queue_status_run_at ON job_queue(status, run_at);
CREATE INDEX idx_job_queue_run_at ON job_queue(run_at);

-- Job run history indexes (Migration: 049_create_job_queue.ts)
CREATE INDEX idx_job_run_history_queue_id ON job_run_history(queue_id);
CREATE INDEX idx_job_run_history_started_at ON job_run_history(started_at);
CREATE INDEX idx_job_run_history_status ON job_run_history(status);

-- Notification services indexes (Migration: 007_create_notification_tables.ts)
CREATE INDEX idx_notification_services_enabled ON notification_services(enabled);
CREATE INDEX idx_notification_services_type ON notification_services(service_type);

-- Notification history indexes (Migration: 007_create_notification_tables.ts)
CREATE INDEX idx_notification_history_service_id ON notification_history(service_id);
CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX idx_notification_history_status ON notification_history(status);

-- Database instances indexes (Migration: 008_create_database_instances.ts)
CREATE INDEX idx_database_instances_uuid ON database_instances(uuid);

-- Upgrade configs indexes (Migration: 011_create_upgrade_configs.ts)
CREATE INDEX idx_upgrade_configs_arr_instance ON upgrade_configs(arr_instance_id);

-- Arr sync indexes (Migration: 015_create_arr_sync_tables.ts)
CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);

-- ==============================================================================
-- TABLE: regex101_cache
-- Purpose: Cache regex101 API responses to avoid redundant fetches
-- Migration: 017_create_regex101_cache.ts
-- ==============================================================================

CREATE TABLE regex101_cache (
    regex101_id TEXT PRIMARY KEY,           -- Versioned ID (e.g., "ABC123/1")
    response TEXT NOT NULL,                 -- Full JSON response with test results
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: app_info
-- Purpose: Store application metadata (singleton pattern with id=1)
-- Migration: 018_create_app_info.ts
-- ==============================================================================

CREATE TABLE app_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version TEXT NOT NULL,                  -- Application version (e.g., "2.0.0")
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: tmdb_settings
-- Purpose: Store TMDB API configuration (singleton pattern with id=1)
-- Migration: 020_create_tmdb_settings.ts
-- ==============================================================================

CREATE TABLE tmdb_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- TMDB Configuration
    api_key TEXT NOT NULL DEFAULT '',       -- TMDB API key for authentication

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: parsed_release_cache
-- Purpose: Cache parsed release titles from parser microservice
-- Migration: 021_create_parsed_release_cache.ts
-- ==============================================================================

CREATE TABLE parsed_release_cache (
    cache_key TEXT PRIMARY KEY,             -- "{title}:{type}" e.g. "Movie.2024.1080p.WEB-DL:movie"
    parser_version TEXT NOT NULL,           -- Parser version when cached (for invalidation)
    parsed_result TEXT NOT NULL,            -- Full JSON ParseResult from parser
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parsed_release_cache_version ON parsed_release_cache(parser_version);
CREATE INDEX idx_parsed_release_cache_created_at ON parsed_release_cache(created_at);

-- ==============================================================================
-- TABLE: pattern_match_cache
-- Purpose: Cache regex pattern match results to avoid redundant computation
-- Migration: 023_create_pattern_match_cache.ts
-- ==============================================================================

CREATE TABLE pattern_match_cache (
    title TEXT NOT NULL,                    -- Release title being matched
    patterns_hash TEXT NOT NULL,            -- Hash of all patterns (for invalidation)
    match_results TEXT NOT NULL,            -- JSON object: { pattern: boolean }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (title, patterns_hash)
);

CREATE INDEX idx_pattern_match_cache_hash ON pattern_match_cache(patterns_hash);
CREATE INDEX idx_pattern_match_cache_created_at ON pattern_match_cache(created_at);

-- ==============================================================================
-- TABLE: arr_rename_settings
-- Purpose: Store rename configuration per arr instance for bulk file/folder renaming
-- Migration: 024_create_arr_rename_settings.ts, 025_add_rename_notification_mode.ts, 051_cron_scheduling.ts
-- ==============================================================================

CREATE TABLE arr_rename_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Relationship (one config per arr instance)
    arr_instance_id INTEGER NOT NULL UNIQUE,

    -- Settings
    dry_run INTEGER NOT NULL DEFAULT 1,         -- 1=preview only, 0=make changes
    rename_folders INTEGER NOT NULL DEFAULT 0,  -- 1=rename folders too, 0=files only
    ignore_tag TEXT,                            -- Tag name to skip (items with tag won't be renamed)
    summary_notifications INTEGER NOT NULL DEFAULT 1, -- 1=summary, 0=rich (Migration 025)

    -- Job scheduling
    enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch for scheduled job
    cron TEXT NOT NULL DEFAULT '0 0 * * *',     -- Cron expression (Migration 051, replaced schedule)
    next_run_at TEXT,                           -- Next scheduled run (Migration 051)
    last_run_at DATETIME,                       -- When rename job last ran

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- Arr rename settings indexes (Migration: 024_create_arr_rename_settings.ts)
CREATE INDEX idx_arr_rename_settings_arr_instance ON arr_rename_settings(arr_instance_id);

-- ==============================================================================
-- TABLE: arr_cleanup_settings
-- Purpose: Store cleanup scheduling configuration per arr instance
-- Migration: 052_create_arr_cleanup_settings.ts
-- ==============================================================================

CREATE TABLE arr_cleanup_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Relationship (one config per arr instance)
    arr_instance_id INTEGER NOT NULL UNIQUE,

    -- Settings
    enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch
    cron TEXT NOT NULL DEFAULT '0 0 * * 0',     -- Cron expression (default: weekly Sunday midnight)

    -- State tracking
    next_run_at TEXT,                           -- Next scheduled run
    last_run_at TEXT,                           -- When cleanup job last ran

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- Arr cleanup settings indexes (Migration: 052_create_arr_cleanup_settings.ts)
CREATE INDEX idx_arr_cleanup_settings_instance ON arr_cleanup_settings(arr_instance_id);

-- ==============================================================================
-- TABLE: upgrade_runs
-- Purpose: Store upgrade run history for each arr instance
-- Migration: 026_create_upgrade_runs.ts
-- ==============================================================================

CREATE TABLE upgrade_runs (
    id TEXT PRIMARY KEY,                        -- UUID

    -- Relationship
    instance_id INTEGER NOT NULL,               -- Foreign key to arr_instances

    -- Timing
    started_at TEXT NOT NULL,                   -- ISO timestamp when run started
    completed_at TEXT NOT NULL,                 -- ISO timestamp when run completed

    -- Status
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
    dry_run INTEGER NOT NULL DEFAULT 0,         -- 1=dry run, 0=live

    -- Config snapshot (flat for queryability)
    cron TEXT NOT NULL,                         -- Cron expression (Migration 051, renamed from schedule)
    filter_mode TEXT NOT NULL,                  -- 'round_robin' or 'random'
    filter_name TEXT NOT NULL,                  -- Name of the filter used

    -- Library stats
    library_total INTEGER NOT NULL,             -- Total items in library
    library_cached INTEGER NOT NULL DEFAULT 0,  -- 1=fetched from cache
    library_fetch_ms INTEGER NOT NULL,          -- Time to fetch library in ms

    -- Filter stats
    matched_count INTEGER NOT NULL,             -- Items matching filter rules
    after_cooldown INTEGER NOT NULL,            -- Items after cooldown applied
    cooldown_hours INTEGER NOT NULL,            -- Cooldown hours setting
    dry_run_excluded INTEGER NOT NULL DEFAULT 0,-- Items excluded by dry run cache

    -- Selection stats
    selection_method TEXT NOT NULL,             -- Selector method used
    selection_requested INTEGER NOT NULL,       -- Items requested to select
    selected_count INTEGER NOT NULL,            -- Items actually selected

    -- Results stats
    searches_triggered INTEGER NOT NULL,        -- Number of searches triggered
    successful INTEGER NOT NULL,                -- Successful upgrades found
    failed INTEGER NOT NULL,                    -- Failed searches

    -- Complex data as JSON
    items TEXT NOT NULL DEFAULT '[]',           -- JSON array of UpgradeSelectionItem
    errors TEXT NOT NULL DEFAULT '[]',          -- JSON array of error strings

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- Upgrade runs indexes (Migration: 026_create_upgrade_runs.ts)
CREATE INDEX idx_upgrade_runs_instance ON upgrade_runs(instance_id);
CREATE INDEX idx_upgrade_runs_started_at ON upgrade_runs(started_at DESC);
CREATE INDEX idx_upgrade_runs_status ON upgrade_runs(status);

-- ==============================================================================
-- TABLE: rename_runs
-- Purpose: Store rename run history for each arr instance
-- Migration: 027_create_rename_runs.ts
-- ==============================================================================

CREATE TABLE rename_runs (
    id TEXT PRIMARY KEY,                        -- UUID

    -- Relationship
    instance_id INTEGER NOT NULL,               -- Foreign key to arr_instances

    -- Timing
    started_at TEXT NOT NULL,                   -- ISO timestamp when run started
    completed_at TEXT NOT NULL,                 -- ISO timestamp when run completed

    -- Status
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
    dry_run INTEGER NOT NULL DEFAULT 1,         -- 1=dry run, 0=live
    manual INTEGER NOT NULL DEFAULT 0,          -- 1=manually triggered, 0=scheduled

    -- Config snapshot
    rename_folders INTEGER NOT NULL DEFAULT 0,  -- 1=rename folders too
    ignore_tag TEXT,                            -- Tag name to skip

    -- Library stats
    library_total INTEGER NOT NULL,             -- Total items in library
    library_fetch_ms INTEGER NOT NULL,          -- Time to fetch library in ms

    -- Filtering stats
    after_ignore_tag INTEGER NOT NULL,          -- Items after ignore tag filter
    skipped_by_tag INTEGER NOT NULL,            -- Items skipped due to tag

    -- Results stats
    files_needing_rename INTEGER NOT NULL,      -- Files that need renaming
    files_renamed INTEGER NOT NULL,             -- Files actually renamed
    folders_renamed INTEGER NOT NULL,           -- Folders renamed
    commands_triggered INTEGER NOT NULL,        -- Rename commands triggered
    commands_completed INTEGER NOT NULL,        -- Commands completed successfully
    commands_failed INTEGER NOT NULL,           -- Commands that failed

    -- Complex data as JSON
    items TEXT NOT NULL DEFAULT '[]',           -- JSON array of renamed items
    errors TEXT NOT NULL DEFAULT '[]',          -- JSON array of error strings

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
);

-- Rename runs indexes (Migration: 027_create_rename_runs.ts)
CREATE INDEX idx_rename_runs_instance ON rename_runs(instance_id);
CREATE INDEX idx_rename_runs_started_at ON rename_runs(started_at DESC);
CREATE INDEX idx_rename_runs_status ON rename_runs(status);

-- ==============================================================================
-- TABLE: general_settings
-- Purpose: Store general app-wide settings (singleton pattern with id=1)
-- Migration: 030_create_general_settings.ts
-- ==============================================================================

CREATE TABLE general_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    -- Default delay profile settings
    apply_default_delay_profiles INTEGER NOT NULL DEFAULT 1,  -- 1=apply defaults when adding arr, 0=don't

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: github_cache
-- Purpose: Cache GitHub API responses (repo info, avatars, releases) to reduce API calls
-- Migration: 033_create_github_cache.ts
-- ==============================================================================

CREATE TABLE github_cache (
    cache_key TEXT PRIMARY KEY,             -- e.g., "repo:owner/repo", "avatar:owner", "releases:owner/repo"
    cache_type TEXT NOT NULL,               -- "repo_info", "avatar", "releases"
    data TEXT NOT NULL,                     -- JSON response data (or base64 data URL for images)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL            -- TTL-based expiration
);

-- GitHub cache indexes (Migration: 033_create_github_cache.ts)
CREATE INDEX idx_github_cache_type ON github_cache(cache_type);
CREATE INDEX idx_github_cache_expires ON github_cache(expires_at);

-- ==============================================================================
-- TABLE: users
-- Purpose: Store admin user credentials (single-user app)
-- Migration: 036_create_auth_tables.ts
-- ==============================================================================

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: sessions
-- Purpose: Store user sessions (allows login from multiple devices)
-- Migration: 036_create_auth_tables.ts, 037_add_session_metadata.ts
-- ==============================================================================

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                    -- UUID
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Session metadata (Migration 037)
    ip_address TEXT,                        -- Client IP when session created
    user_agent TEXT,                        -- Full user agent string
    browser TEXT,                           -- Parsed browser name/version (e.g., "Chrome 120")
    os TEXT,                                -- Parsed OS (e.g., "Windows 11")
    device_type TEXT,                       -- Device category (Desktop, Mobile, Tablet)
    last_active_at DATETIME,                            -- Updated on sliding expiration

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ==============================================================================
-- TABLE: auth_settings
-- Purpose: Store auth configuration (singleton pattern with id=1)
-- Migration: 036_create_auth_tables.ts, 056_add_local_bypass.ts
-- ==============================================================================

CREATE TABLE auth_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    session_duration_hours INTEGER NOT NULL DEFAULT 168,  -- 7 days
    api_key TEXT,                           -- Bcrypt-hashed API key for programmatic access
    local_bypass_enabled INTEGER NOT NULL DEFAULT 0, -- Skip auth for local IPs (Migration 056)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: setup_state
-- Purpose: Track one-time setup operations (singleton pattern with id=1)
-- Migration: 039_create_setup_state.ts
-- ==============================================================================

CREATE TABLE setup_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_database_linked INTEGER NOT NULL DEFAULT 0,  -- 1=default db has been linked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- TABLE: login_attempts
-- Purpose: Track failed login attempts for rate limiting
-- Migration: 055_create_login_attempts.ts
-- ==============================================================================

CREATE TABLE login_attempts (
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'unknown',
    failed_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_login_attempts_lookup ON login_attempts(ip, endpoint, failed_at);
