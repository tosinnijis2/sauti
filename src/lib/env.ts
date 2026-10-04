const productionRequired = ["DATABASE_URL", "AUTH_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CRON_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "APP_URL"] as const;

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return { valid: true, missing: [] as string[] };
  const missing: string[] = productionRequired.filter(name => !env[name]?.trim());
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) missing.push("AUTH_SECRET(minimum 32 characters)");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 32) missing.push("CRON_SECRET(minimum 32 characters)");
  if (env.APP_URL) {
    try { if (new URL(env.APP_URL).protocol !== "https:") missing.push("APP_URL(HTTPS required)"); }
    catch { missing.push("APP_URL(valid HTTPS URL required)"); }
  }
  return { valid: missing.length === 0, missing };
}

export function assertProductionEnvironment() {
  const result = validateProductionEnvironment();
  if (!result.valid) throw new Error(`Missing or invalid production configuration: ${result.missing.join(", ")}`);
}
