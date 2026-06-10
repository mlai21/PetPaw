CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS advisor_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON advisor_sessions(user_id, last_active_at);

CREATE TABLE IF NOT EXISTS advisor_runtimes (
  run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  terminal_state TEXT,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  message_length_bucket TEXT,
  policy_version TEXT,
  FOREIGN KEY (session_id) REFERENCES advisor_sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_runtimes_session ON advisor_runtimes(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_runtimes_terminal ON advisor_runtimes(terminal_state, started_at);

CREATE TABLE IF NOT EXISTS advisor_tasks (
  task_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_index INTEGER NOT NULL,
  terminal_state TEXT NOT NULL,
  need_search INTEGER NOT NULL,
  tool_used TEXT,
  tool_result TEXT,
  duration_ms INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  keyword_category TEXT,
  FOREIGN KEY (run_id) REFERENCES advisor_runtimes(run_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_run ON advisor_tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON advisor_tasks(keyword_category, terminal_state);

CREATE TABLE IF NOT EXISTS advisor_stage_traces (
  trace_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES advisor_runtimes(run_id)
);
CREATE INDEX IF NOT EXISTS idx_stage_traces_run ON advisor_stage_traces(run_id, stage);

CREATE TABLE IF NOT EXISTS advisor_policies (
  version TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  scope TEXT NOT NULL,
  conditions_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  rollout_pct INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_policies_scope_rollout ON advisor_policies(scope, rollout_pct);
