import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET", "dev-jwt-secret"),
  agentInternalKey: required("AGENT_INTERNAL_KEY", "dev-agent-key"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
