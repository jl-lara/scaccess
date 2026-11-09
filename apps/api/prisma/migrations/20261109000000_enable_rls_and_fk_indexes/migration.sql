-- Enable Row Level Security on every table in the public schema and add the
-- missing foreign-key indexes reported by Supabase Advisors.
--
-- Defense in depth (ADR-0011): the API keeps connecting as the table owner,
-- which bypasses RLS, so RLS only constrains the Supabase API roles:
--   * authenticated: can read its own account, employee and access events.
--   * service_role: full access for the backend.
--   * anon: no policies, therefore no access.
--
-- Policy expressions use `(select auth.uid())` so Supabase does not report the
-- `auth_rls_initplan` warning, and each role/action has a single permissive
-- policy to avoid `multiple_permissive_policies`.

-- ---------------------------------------------------------------------------
-- Missing foreign-key indexes (Performance Advisor: unindexed_foreign_keys)
-- ---------------------------------------------------------------------------

CREATE INDEX "user_roles_assigned_by_idx" ON "user_roles"("assigned_by");

CREATE INDEX "access_permissions_granted_by_idx" ON "access_permissions"("granted_by");

CREATE INDEX "access_events_credential_id_idx" ON "access_events"("credential_id");

-- ---------------------------------------------------------------------------
-- Row Level Security (Security Advisor: rls_disabled_in_public)
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."access_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."access_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."device_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."device_sync_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."device_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."access_events" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Privileged tables: remove direct access from the Supabase API roles.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE "public"."device_credentials" FROM "anon", "authenticated";

-- `_prisma_migrations` only exists when Prisma has been used (not in a fresh
-- shadow database), hence the conditional block.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename = '_prisma_migrations'
    ) THEN
        EXECUTE 'ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'REVOKE ALL ON TABLE "public"."_prisma_migrations" FROM "anon", "authenticated"';
        EXECUTE 'DROP POLICY IF EXISTS "_prisma_migrations_service_role_all" ON "public"."_prisma_migrations"';
        EXECUTE 'CREATE POLICY "_prisma_migrations_service_role_all" ON "public"."_prisma_migrations" FOR ALL TO "service_role" USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Own-row read policies for authenticated users (mobile app, defense in depth)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_accounts_select_own" ON "public"."user_accounts";
CREATE POLICY "user_accounts_select_own"
    ON "public"."user_accounts"
    FOR SELECT
    TO "authenticated"
    USING ("auth_user_id" = (SELECT auth.uid()));

DROP POLICY IF EXISTS "employees_select_own" ON "public"."employees";
CREATE POLICY "employees_select_own"
    ON "public"."employees"
    FOR SELECT
    TO "authenticated"
    USING (
        "id" = (
            SELECT "ua"."employee_id"
            FROM "public"."user_accounts" AS "ua"
            WHERE "ua"."auth_user_id" = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "access_events_select_own" ON "public"."access_events";
CREATE POLICY "access_events_select_own"
    ON "public"."access_events"
    FOR SELECT
    TO "authenticated"
    USING (
        "employee_id" = (
            SELECT "ua"."employee_id"
            FROM "public"."user_accounts" AS "ua"
            WHERE "ua"."auth_user_id" = (SELECT auth.uid())
        )
    );

-- ---------------------------------------------------------------------------
-- Backend-only tables: full access for service_role, none for anon/authenticated.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "employees_service_role_all" ON "public"."employees";
CREATE POLICY "employees_service_role_all"
    ON "public"."employees" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_accounts_service_role_all" ON "public"."user_accounts";
CREATE POLICY "user_accounts_service_role_all"
    ON "public"."user_accounts" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "roles_service_role_all" ON "public"."roles";
CREATE POLICY "roles_service_role_all"
    ON "public"."roles" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_roles_service_role_all" ON "public"."user_roles";
CREATE POLICY "user_roles_service_role_all"
    ON "public"."user_roles" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "credentials_service_role_all" ON "public"."credentials";
CREATE POLICY "credentials_service_role_all"
    ON "public"."credentials" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "areas_service_role_all" ON "public"."areas";
CREATE POLICY "areas_service_role_all"
    ON "public"."areas" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "access_permissions_service_role_all" ON "public"."access_permissions";
CREATE POLICY "access_permissions_service_role_all"
    ON "public"."access_permissions" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "access_devices_service_role_all" ON "public"."access_devices";
CREATE POLICY "access_devices_service_role_all"
    ON "public"."access_devices" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "device_areas_service_role_all" ON "public"."device_areas";
CREATE POLICY "device_areas_service_role_all"
    ON "public"."device_areas" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "device_sync_states_service_role_all" ON "public"."device_sync_states";
CREATE POLICY "device_sync_states_service_role_all"
    ON "public"."device_sync_states" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "device_credentials_service_role_all" ON "public"."device_credentials";
CREATE POLICY "device_credentials_service_role_all"
    ON "public"."device_credentials" FOR ALL TO "service_role" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "access_events_service_role_all" ON "public"."access_events";
CREATE POLICY "access_events_service_role_all"
    ON "public"."access_events" FOR ALL TO "service_role" USING (true) WITH CHECK (true);
