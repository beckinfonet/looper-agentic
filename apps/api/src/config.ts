import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: required("MONGODB_URI"),
  /** When the URI has no `/dbname` segment (common with Atlas “connect” strings), Mongoose uses `test`. Set this to `looper` to match data in DB `looper`. */
  mongoDbName: process.env.MONGODB_DB_NAME?.trim() || undefined,
  jwtSecret: required("JWT_SECRET", "dev-jwt-secret"),
  agentInternalKey: required("AGENT_INTERNAL_KEY", "dev-agent-key"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
