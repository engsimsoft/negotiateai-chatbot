export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

// Edge Runtime compatible: generate dummy password without bcrypt at module level
// bcrypt-ts or its dependencies may use __dirname which breaks Edge Runtime
export const DUMMY_PASSWORD = "dummy-password-hash-for-timing-attack-prevention";
