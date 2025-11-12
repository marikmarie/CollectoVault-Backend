
import { IncomingMessage, ServerResponse } from "http";
import axios from "axios";
import { readJSON } from "./_utils"; 
import dotenv from "dotenv";
dotenv.config();

const COLLECTO_BASE = process.env.COLLECTO_BASE_URL;
const COLLECTO_USERNAME = process.env.COLLECTO_USERNAME;
const COLLECTO_API_KEY = process.env.COLLECTO_API_KEY;

if (!COLLECTO_API_KEY) {
  console.warn("Warning: COLLECTO_API_KEY not set in .env");
}

function maskHeaders(headers: Record<string, any> | undefined) {
  if (!headers) return headers;
  const out: Record<string, any> = {};
  for (const k of Object.keys(headers)) {
    const v = headers[k];
    if (typeof k === "string" && /api[key]|apikey|authorization|token|secret/i.test(k)) {
      out[k] = typeof v === "string" ? v.replace(/./g, "*") : "***";
    } else {
      out[k] = v;
    }
  }
  return out;
}

function safeStringify(x: any, max = 1000) {
  try {
    let s = typeof x === "string" ? x : JSON.stringify(x);
    if (s.length > max) s = s.slice(0, max) + "...[truncated]";
    return s;
  } catch (e) {
    return String(x);
  }
}

export function makeCollectoClient() {
  const client = axios.create({
    baseURL: COLLECTO_BASE,
    timeout: 10000, 
    headers: {
      "x-api-key": COLLECTO_API_KEY,
      "Content-Type": "application/json",
    },
  });


  client.interceptors.request.use((config) => {
    (config as any).metadata = { startTime: Date.now() };
    const method = (config.method || "POST").toString().toUpperCase();
    const url = `${config.baseURL || ""}${config.url || ""}`;
    console.log(`[Collecto -> REQUEST] ${method} ${url} - ${new Date().toISOString()}`);
    console.log("[Collecto -> REQUEST] headers:", maskHeaders(config.headers as any));
    if (config.data) console.log("[Collecto -> REQUEST] body:", safeStringify(config.data, 2000));
    return config;
  }, (error) => {
    console.error("[Collecto -> REQUEST ERROR]", error && error.message ? error.message : error);
    return Promise.reject(error);
  });

  client.interceptors.response.use((response) => {
    const md = (response.config as any).metadata || {};
    const duration = md.startTime ? Date.now() - md.startTime : undefined;
    console.log(`[Collecto <- RESPONSE] ${response.status} ${response.config.url} (${duration}ms)`);
    console.log("[Collecto <- RESPONSE] data:", safeStringify(response.data, 4000));
    return response;
  }, (error) => {
    const cfg = error.config || {};
    const md = (cfg as any).metadata || {};
    const duration = md.startTime ? Date.now() - md.startTime : undefined;
    console.error(`[Collecto <- ERROR] ${cfg.url || "(unknown)"} (${duration}ms) -`, error && error.message ? error.message : error);
    if (error.response) {
      console.error("[Collecto <- ERROR] status:", error.response.status);
      console.error("[Collecto <- ERROR] data:", safeStringify(error.response.data, 4000));
    } else {
    
      console.error("[Collecto <- ERROR] no response object - possible network error or timeout");
    }
    return Promise.reject(error);
  });

  return client;
}

export async function handleCollectoAuth(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  const start = Date.now();
  try {
    const body = req.body || {};
    console.log("[CollectoAuth] body:", body);

    const client = makeCollectoClient();
    const r = await client.post("/auth", body);
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.data));
    console.log(`[CollectoAuth] success (${Date.now() - start}ms)`);
  } catch (err: any) {
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err.message };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    console.error("[CollectoAuth] error:", err?.message);
  }
}

export async function handleCollectoAuthVerify(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  const start = Date.now();
  try {
    const body = req.body || {}; 
    const client = makeCollectoClient();
    const r = await client.post("/authVerify", body);

    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.data));

    console.log(`[CollectoAuthVerify] success (${Date.now() - start}ms)`);
  } catch (err: any) {
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err.message };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    console.error("[CollectoAuthVerify] error:", err?.message);
  }
}
