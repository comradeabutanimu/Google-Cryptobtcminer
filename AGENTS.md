# AI Coding Agent Instructions

## Database Migration & Sync Rules (CRITICAL)
- **STRICTLY FORBIDDEN**: Do NOT run, write, suggest, or include `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any other destructive SQL operations that delete user tables or wipe data.
- **Wiping Prevention**: Never reset or recreate any existing database table.
- **Allowed Operations**:
  - Only use `ALTER TABLE` to perform additive or non-destructive schema changes if modifying existing structures.
  - Only use `INSERT ... ON CONFLICT DO NOTHING` or `upsert` queries to seed/synchronize initial reference or default data (e.g., plans, initial settings). Always check for existence and resolve conflicts safely without deleting prior rows or resetting auto-increment sequences.
