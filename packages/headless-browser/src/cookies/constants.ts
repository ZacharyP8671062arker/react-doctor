export const MS_PER_SECOND = 1000;

// HACK: Unix timestamp for 9999-12-31T23:59:59Z. Used by browser-specific
// expiry normalizers to clamp wildly-out-of-range integers (corrupted
// cookie databases occasionally store years > 9999, which then overflow
// JS Date downstream).
export const MAX_UNIX_EPOCH_SECONDS = 253_402_300_799;

export const SAME_SITE_NONE = 0;
export const SAME_SITE_LAX = 1;
export const SAME_SITE_STRICT = 2;

export const CDP_RETRY_COUNT = 15;
export const CDP_RETRY_BASE_DELAY_MS = 100;
export const CDP_RETRY_BACKOFF_CAP_EXPONENT = 5;
export const CDP_COOKIE_READ_TIMEOUT_MS = 10_000;

export const HEADLESS_CHROME_ARGS = [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1",
] as const;

export const CHROMIUM_META_VERSION_HASH_PREFIX = 24;
export const PBKDF2_ITERATIONS_DARWIN = 1003;
export const PBKDF2_ITERATIONS_LINUX = 1;
export const DPAPI_PREFIX_LENGTH_BYTES = 5;

export const CONCURRENCY_PROFILE_SCAN = 10;
