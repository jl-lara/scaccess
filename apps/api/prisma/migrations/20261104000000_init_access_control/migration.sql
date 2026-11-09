-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "employee_status" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "credential_status" AS ENUM ('active', 'blocked', 'lost', 'retired');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('active', 'inactive', 'maintenance');

-- CreateEnum
CREATE TYPE "access_decision" AS ENUM ('granted', 'denied');

-- CreateEnum
CREATE TYPE "access_reason" AS ENUM ('allowed', 'card_unknown', 'card_blocked', 'card_lost', 'card_retired', 'employee_inactive', 'permission_missing', 'permission_expired', 'permission_outside_schedule', 'area_not_allowed', 'area_inactive', 'device_error');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_code" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320),
    "department" VARCHAR(100),
    "position" VARCHAR(100),
    "status" "employee_status" NOT NULL DEFAULT 'active',
    "hired_at" DATE,
    "deactivated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" UUID NOT NULL,
    "employee_id" UUID,
    "email" VARCHAR(320) NOT NULL,
    "status" "account_status" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "card_uid" VARCHAR(32) NOT NULL,
    "label" VARCHAR(64),
    "status" "credential_status" NOT NULL DEFAULT 'active',
    "issued_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Tijuana',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "schedule" JSONB,
    "revoked_at" TIMESTAMPTZ(6),
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "access_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(128),
    "status" "device_status" NOT NULL DEFAULT 'active',
    "hardware_model" VARCHAR(32),
    "firmware_version" VARCHAR(32),
    "config_version" BIGINT NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(6),
    "provisioned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "access_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_areas" (
    "device_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_areas_pkey" PRIMARY KEY ("device_id","area_id")
);

-- CreateTable
CREATE TABLE "device_sync_states" (
    "device_id" UUID NOT NULL,
    "config_version" BIGINT NOT NULL DEFAULT 0,
    "last_sync_requested_at" TIMESTAMPTZ(6),
    "last_sync_completed_at" TIMESTAMPTZ(6),
    "last_event_received_at" TIMESTAMPTZ(6),
    "last_event_occurred_at" TIMESTAMPTZ(6),
    "pending_event_count_reported" INTEGER,
    "last_error_code" VARCHAR(64),
    "last_error_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_sync_states_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "device_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "token_id" VARCHAR(64) NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "device_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "client_event_id" VARCHAR(64) NOT NULL,
    "device_epoch" UUID,
    "card_uid" VARCHAR(32) NOT NULL,
    "employee_id" UUID,
    "credential_id" UUID,
    "area_id" UUID NOT NULL,
    "decision" "access_decision" NOT NULL,
    "reason_code" "access_reason" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_sequence" BIGINT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_auth_user_id_key" ON "user_accounts"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_employee_id_key" ON "user_accounts"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_card_uid_key" ON "credentials"("card_uid");

-- CreateIndex
CREATE INDEX "credentials_employee_id_idx" ON "credentials"("employee_id");

-- CreateIndex
CREATE INDEX "credentials_status_idx" ON "credentials"("status");

-- CreateIndex
CREATE UNIQUE INDEX "areas_code_key" ON "areas"("code");

-- CreateIndex
CREATE INDEX "access_permissions_employee_id_area_id_idx" ON "access_permissions"("employee_id", "area_id");

-- CreateIndex
CREATE INDEX "access_permissions_area_id_idx" ON "access_permissions"("area_id");

-- CreateIndex
CREATE INDEX "access_permissions_valid_from_valid_to_idx" ON "access_permissions"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "access_devices_device_code_key" ON "access_devices"("device_code");

-- CreateIndex
CREATE INDEX "access_devices_status_idx" ON "access_devices"("status");

-- CreateIndex
CREATE INDEX "access_devices_last_seen_at_idx" ON "access_devices"("last_seen_at");

-- CreateIndex
CREATE INDEX "device_areas_area_id_idx" ON "device_areas"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_credentials_token_id_key" ON "device_credentials"("token_id");

-- CreateIndex
CREATE INDEX "device_credentials_device_id_idx" ON "device_credentials"("device_id");

-- CreateIndex
CREATE INDEX "access_events_occurred_at_idx" ON "access_events"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "access_events_employee_id_occurred_at_idx" ON "access_events"("employee_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "access_events_device_id_occurred_at_idx" ON "access_events"("device_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "access_events_area_id_occurred_at_idx" ON "access_events"("area_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "access_events_received_at_idx" ON "access_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "access_events_device_id_client_event_id_key" ON "access_events"("device_id", "client_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_events_device_id_device_sequence_key" ON "access_events"("device_id", "device_sequence");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_permissions" ADD CONSTRAINT "access_permissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_permissions" ADD CONSTRAINT "access_permissions_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_permissions" ADD CONSTRAINT "access_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_areas" ADD CONSTRAINT "device_areas_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "access_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_areas" ADD CONSTRAINT "device_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_states" ADD CONSTRAINT "device_sync_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "access_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "access_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "access_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
