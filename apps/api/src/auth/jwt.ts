import jwt from "jsonwebtoken";
import type { FastifyRequest } from "fastify";
import { config } from "../config.js";

export type UserJwtPayload = { sub: string; typ: "user" };
export type BusinessJwtPayload = { sub: string; businessId: string; typ: "business" };

export function signUserToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "user" } satisfies UserJwtPayload, config.jwtSecret, {
    expiresIn: "30d",
  });
}

export function signBusinessToken(businessUserId: string, businessId: string): string {
  return jwt.sign(
    { sub: businessUserId, businessId, typ: "business" } satisfies BusinessJwtPayload,
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyUserToken(token: string): UserJwtPayload {
  const p = jwt.verify(token, config.jwtSecret) as UserJwtPayload;
  if (p.typ !== "user") throw new Error("Invalid token type");
  return p;
}

export function verifyBusinessToken(token: string): BusinessJwtPayload {
  const p = jwt.verify(token, config.jwtSecret) as BusinessJwtPayload;
  if (p.typ !== "business") throw new Error("Invalid token type");
  return p;
}

export function getBearerToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return undefined;
  return h.slice(7);
}
