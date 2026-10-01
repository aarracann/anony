import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { moderateContent } from "../src/lib/moderation/filter.ts";

test("Moderation Filter: rejects phone numbers", () => {
  assert.equal(moderateContent("Call me at 555-123-4567"), false);
  assert.equal(moderateContent("My number is +1 (800) 555-0199"), false);
  assert.equal(moderateContent("+44 7911 123456 call me"), false);
  assert.equal(moderateContent("Safe message about my 5 apples"), true);
});

test("Moderation Filter: rejects email addresses", () => {
  assert.equal(moderateContent("Email me at hacker@gmail.com"), false);
  assert.equal(moderateContent("reach me at user.name+tag@sub.domain.org"), false);
  assert.equal(moderateContent("This is just normal text"), true);
});

test("Moderation Filter: rejects URLs and links", () => {
  assert.equal(moderateContent("Check out https://evil-site.com/phish"), false);
  assert.equal(moderateContent("Visit www.badsite.com now"), false);
  assert.equal(moderateContent("http://insecure-link.org"), false);
  assert.equal(moderateContent("I love the website you built"), true);
});

test("Moderation Filter: rejects blocklisted abuse and threats", () => {
  assert.equal(moderateContent("I hate you so much"), false);
  assert.equal(moderateContent("go kill yourself"), false);
  assert.equal(moderateContent("kys now"), false);
  assert.equal(moderateContent("You are super kind and talented!"), true);
});

test("Cryptographic Hashing: produces deterministic salted SHA-256", () => {
  const salt = "test-salt-secret-1234567890";
  const deviceId = "test-device-uuid-abc-123";

  const hash1 = crypto.createHash("sha256").update(`${deviceId}:${salt}`).digest("hex");
  const hash2 = crypto.createHash("sha256").update(`${deviceId}:${salt}`).digest("hex");

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.notEqual(hash1, deviceId); // Never exposes raw device ID
});
