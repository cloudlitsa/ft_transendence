CREATE UNIQUE INDEX "one_active_alert_per_sender"
ON "alerts" ("sender_id")
WHERE "status" = 'active';