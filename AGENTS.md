# AI Coding Agent Instructions

## Database Migration & Sync Rules (CRITICAL)
- **STRICTLY FORBIDDEN**: Do NOT run, write, suggest, or include `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any other destructive SQL/DDL operations on any Supabase/database table that wipes data, drops tables, or resets tables.
- **Wiping Prevention**: Never drop, reset, truncate, or recreate any existing table or schema.
- **Allowed Operations**:
  - For future database changes, only use `ALTER TABLE ADD COLUMN IF NOT EXISTS` for new columns and `CREATE TABLE IF NOT EXISTS` for brand-new tables.
- **User Data Preservation**: All existing user data, balances, transactions, deposits, withdrawals, plans, and announcements must be permanently preserved across every single code change, database schema patch, migration, and deployment.
- **Pre-deployment Verification**: Before every deployment, verify that no destructive SQL exists anywhere in the codebase.

