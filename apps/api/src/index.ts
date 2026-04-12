import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { registerRoutes } from "./routes/register.js";

const app = Fastify({ logger: true });

app.setErrorHandler((err: Error & { validation?: unknown; statusCode?: number }, req, reply) => {
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: "Invalid request", details: err.flatten() });
  }
  if (err.validation) {
    return reply.status(400).send({ error: "Validation failed", details: err.validation });
  }
  const status = err.statusCode ?? 500;
  const message = status >= 500 ? "Internal Server Error" : err.message;
  if (status >= 500) req.log.error(err);
  return reply.status(status).send({ error: message });
});

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()),
  credentials: true,
});

await app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
  allowList: (req) =>
    req.url === "/health" ||
    String(req.headers["x-internal-key"] ?? "") === config.agentInternalKey,
});

await registerRoutes(app);

await connectDb();

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
