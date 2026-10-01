"use client";

/**
 * Returns a persistent anonymous client device ID stored in localStorage.
 * This ID is sent in headers / payload to the send-message function, where
 * it is salted and hashed via SHA-256 (device_hash) to enforce rate limits
 * and blocking without compromising sender anonymity.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-mock-device-id";
  }

  const STORAGE_KEY = "anony_device_uuid";
  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId || deviceId.trim().length < 8) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}
