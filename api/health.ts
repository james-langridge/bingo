import { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || "not set",
      VERCEL: !!process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV || "not set",
    },
    redis: {
      configured: false,
      hasUrl: false,
      hasToken: false,
      canConnect: false,
      error: null as string | null,
    },
  };

  // Check Redis configuration
  health.redis.hasUrl = !!process.env.KV_REST_API_URL;
  health.redis.hasToken = !!process.env.KV_REST_API_TOKEN;
  health.redis.configured = health.redis.hasUrl && health.redis.hasToken;

  // Try to connect to Redis if configured
  if (health.redis.configured) {
    try {
      const redis = new Redis({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      });
      
      // Try a simple ping operation
      await redis.set("health:check", Date.now(), { ex: 60 });
      const value = await redis.get("health:check");
      
      health.redis.canConnect = !!value;
    } catch (error) {
      health.redis.canConnect = false;
      health.redis.error = error instanceof Error ? error.message : String(error);
      health.status = "degraded";
    }
  } else {
    health.status = "degraded";
    health.redis.error = "Missing Redis credentials";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
}