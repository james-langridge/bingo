import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Test endpoint hit!", {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  res.status(200).json({
    message: "API is working!",
    timestamp: new Date().toISOString(),
    env: {
      hasRedisUrl: !!process.env.KV_REST_API_URL,
      hasRedisToken: !!process.env.KV_REST_API_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    },
  });
}
