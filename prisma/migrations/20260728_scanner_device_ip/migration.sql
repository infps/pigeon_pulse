-- Add deviceIp to RfidScans for per-device scan isolation
ALTER TABLE "RfidScans" ADD COLUMN "DEVICE_IP" TEXT;

CREATE INDEX "RfidScans_DEVICE_IP_idx" ON "RfidScans"("DEVICE_IP");
