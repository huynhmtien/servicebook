-- API keys / tokens entered in the app's Settings page. Values are AES-GCM encrypted (key derived from the
-- SESSION_SECRET Worker secret), so a database dump alone does not reveal them. See src/lib/secret-crypto.ts.
CREATE TABLE app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
