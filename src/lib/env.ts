const productionRequired = ["DATABASE_URL", "AUTH_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CRON_SECRET"] as const;
const productionEmailRequired = ["RESEND_API_KEY", "EMAIL_FROM", "APP_URL"] as const;

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return { valid: true, missing: [] as string[], warnings: [] as string[] };
  const missing: string[] = productionRequired.filter(name => !env[name]?.trim());
  const warnings: string[] = [];
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) missing.push("AUTH_SECRET(minimum 32 characters)");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 32) missing.push("CRON_SECRET(minimum 32 characters)");
  const missingEmail = productionEmailRequired.filter(name => !env[name]?.trim());
  if (missingEmail.length > 0) warnings.push(`Email delivery disabled: missing ${missingEmail.join(", ")}`);
  if (env.APP_URL?.trim()) {
    try { if (new URL(env.APP_URL).protocol !== "https:") warnings.push("Email links disabled: APP_URL must use HTTPS"); }
    catch { warnings.push("Email links disabled: APP_URL must be a valid HTTPS URL"); }
  }
  return { valid: missing.length === 0, missing, warnings };
}

export function assertProductionEnvironment() {
  const result = validateProductionEnvironment();
  if (!result.valid) throw new Error(`Missing or invalid production configuration: ${result.missing.join(", ")}`);
  if (result.warnings.length > 0) {
    console.warn("[sauti:production-configuration-warning]", JSON.stringify({ warnings: result.warnings }));
  }
}
