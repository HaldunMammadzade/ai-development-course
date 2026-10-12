ALTER TABLE "plans" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "plans" ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TYPE "subscription_status" AS ENUM ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'expired');

CREATE TABLE "plan_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_code" "plan_code" NOT NULL,
  "slug" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "billing_interval" TEXT NOT NULL,
  "provider_price_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_customers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_customer_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_customer_id" TEXT NOT NULL,
  "provider_subscription_id" TEXT,
  "price_id" UUID NOT NULL,
  "status" "subscription_status" NOT NULL,
  "current_period_start" TIMESTAMPTZ,
  "current_period_end" TIMESTAMPTZ,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMPTZ,
  "scheduled_price_id" UUID,
  "last_event_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkout_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "client_checkout_id" UUID NOT NULL,
  "price_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_checkout_id" TEXT,
  "checkout_url" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_prices_slug_key" ON "plan_prices"("slug");
CREATE UNIQUE INDEX "plan_prices_provider_price_id_key" ON "plan_prices"("provider_price_id");
CREATE UNIQUE INDEX "payment_customers_user_id_key" ON "payment_customers"("user_id");
CREATE UNIQUE INDEX "payment_customers_provider_provider_customer_id_key" ON "payment_customers"("provider", "provider_customer_id");
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");
CREATE UNIQUE INDEX "checkout_sessions_provider_checkout_id_key" ON "checkout_sessions"("provider_checkout_id");
CREATE UNIQUE INDEX "checkout_sessions_user_id_client_checkout_id_key" ON "checkout_sessions"("user_id", "client_checkout_id");
CREATE UNIQUE INDEX "payment_events_provider_provider_event_id_key" ON "payment_events"("provider", "provider_event_id");

ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_scheduled_price_id_fkey" FOREIGN KEY ("scheduled_price_id") REFERENCES "plan_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
