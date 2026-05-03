import { MAX_UNIX_EPOCH_SECONDS } from "../constants";

// HACK: Firefox's `moz_cookies.expiry` column is INTEGER stored as a
// Unix timestamp in SECONDS — NOT milliseconds and NOT Chromium's
// 1601-epoch microseconds. Pass it through unchanged after a sanity
// clamp; dividing by 1000 (an early bug here) sent every extracted
// Firefox cookie back to January 1970, marking them all as expired.
// See netwerk/cookie/CookiePersistentStorage.cpp in mozilla-central.
export const normalizeFirefoxExpiry = (
  value: number | bigint | string | undefined,
): number | undefined => {
  if (value === undefined) return undefined;

  let seconds: number;
  if (typeof value === "bigint") {
    seconds = Number(value);
  } else if (typeof value === "string") {
    seconds = Number(value);
  } else {
    seconds = value;
  }

  if (!Number.isFinite(seconds)) return undefined;
  if (seconds <= 0) return undefined;
  if (seconds > MAX_UNIX_EPOCH_SECONDS) return undefined;
  return Math.floor(seconds);
};
