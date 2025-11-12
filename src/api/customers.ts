// src/api/customerDetails.ts
import { IncomingMessage, ServerResponse } from "http";
import { pool } from "../db/connection";
import { makeCollectoClient } from "./collectoAuth";
import dotenv from "dotenv";
dotenv.config();

/* ----- Types ----- */
type Invoice = {
  transactionId: string;
  business_id?: number;
  businessId?: number;
  amount: number;
  phone?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

export type PointRuleRow = {
  id: number;
  business_id: number;
  name: string;
  type: string;
  params: any;
  priority: number;
};

export type TierRow = {
  id: number;
  business_id: number;
  name: string;
  min_points: number;
  benefits?: any;
};

/* ----- DB helpers ----- */
export async function loadPointRulesForBusiness(businessId: number): Promise<PointRuleRow[]> {
  const q = `SELECT id, business_id, name, type, params, priority FROM point_rule WHERE business_id = ? ORDER BY priority ASC`;
  const [rows] = await pool.query(q, [businessId]);
  return (rows as any) as PointRuleRow[];
}

export async function loadTiersForBusiness(businessId: number): Promise<TierRow[]> {
  const q = `SELECT id, business_id, name, min_points, benefits FROM tier_rule WHERE business_id = ? ORDER BY min_points ASC`;
  const [rows] = await pool.query(q, [businessId]);
  return (rows as any) as TierRow[];
}

/* ----- Rule evaluation ----- */
export function evaluateRules(amount: number, rules: PointRuleRow[], basePoints = 0) {
  let totalPoints = basePoints;
  const applied: Array<{ id: number; name: string; type: string; points: number }> = [];

  for (const r of rules) {
    let params = r.params;
    if (typeof params === "string" && params.length) {
      try {
        params = JSON.parse(params);
      } catch {
        params = {};
      }
    }
    params = params || {};

    let pts = 0;
    switch (r.type) {
      case "per_amount": {
        const per = Number(params.per ?? 100);
        const pointsPer = Number(params.points ?? 1);
        if (per > 0) pts = Math.floor(amount / per) * pointsPer;
        break;
      }
      case "fixed": {
        pts = Number(params.points ?? 0);
        break;
      }
      case "multiplier": {
        const mult = Number(params.multiplier ?? 1);
        pts = Math.floor((totalPoints + basePoints) * (mult - 1));
        break;
      }
      case "campaign": {
        const now = new Date();
        const start = params.start ? new Date(params.start) : null;
        const end = params.end ? new Date(params.end) : null;
        if ((!start || now >= start) && (!end || now <= end)) {
          pts = Number(params.extra_points ?? 0);
        }
        break;
      }
      default:
        pts = 0;
    }

    if (pts > 0) {
      applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
      totalPoints += pts;
    }
  }

  return { points: totalPoints, applied };
}

/* ----- Tier helper ----- */
export function findTierForPoints(tiers: TierRow[], totalPoints: number): TierRow | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = tiers.slice().sort((a, b) => a.min_points - b.min_points);
  let matched: TierRow | null = null;
  for (const t of sorted) {
    if (totalPoints >= Number(t.min_points)) matched = t;
    else break;
  }
  return matched;
}

/* ----- Utility: extract vault token from headers ----- */
function extractVaultTokenFromReq(req: IncomingMessage & { headers?: any }) {
  const headers = req.headers || {};
  // Accept Authorization: Bearer <token> OR custom header vaultOtpToken (case-insensitive)
  let token = "";
  if (typeof headers.authorization === "string" && headers.authorization.trim().length) {
    token = headers.authorization.replace(/^Bearer\s+/i, "").trim();
  }
  if (!token) {
    // check a few header name variations
    token = (headers["vaultOtpToken"] || headers["vaultotpToken"] || headers["vaultotptoken"] || headers["x-vault-otptoken"] || "") as string;
    if (typeof token !== "string") token = "";
  }
  return token || null;
}

/* ----- Shared helper: fetch invoices from Collecto (returns data) ----- */
export async function fetchInvoicesFromCollecto(token: string, body: any = {}) {
  if (!token) throw new Error("Missing token");
  const client = makeCollectoClient();
  // include the vault token as Authorization header when requesting Collecto
  // (Collecto should accept this token and identify the customer)
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // Use POST because many collecto endpoints expect POST with payload (adjust if yours expects GET)
  const r = await client.post("/getInvoices", body, { headers });
  return r.data;
}

/* ----- Handler: getClientInvoices (API endpoint) ----- */
export async function getClientInvoices(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const token = extractVaultTokenFromReq(req as any);
    if (!token) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Missing vault token" }));
      return;
    }
    
    const body = req.body || {};

    const data = await fetchInvoicesFromCollecto(token, body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err: any) {
    console.error("[getClientInvoices] error:", err?.message ?? err);
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err?.message ?? "Unable to fetch invoices" };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}

export async function getCustomerDetails(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const token = extractVaultTokenFromReq(req as any);
    if (!token) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Missing vault token" }));
      return;
    }

    console.log("Fetching customer details with token:", token);
    const body = req.body || {};

    const collectoData = await fetchInvoicesFromCollecto(token, body);

    // Normalize response structure: Collecto may return { invoices: [...] } or an array
    const invoicesRaw = Array.isArray(collectoData) ? collectoData : ((collectoData as any)?.invoices ?? ((collectoData as any)?.data ?? []));
    const invoices: Invoice[] = (invoicesRaw as any[]).map((inv: any) => ({
      transactionId: inv.transactionId ?? inv.id ?? inv.txId ?? inv.reference ?? "",
      business_id: inv.business_id ?? inv.businessId ?? inv.merchantId ?? 0,
      businessId: inv.businessId ?? inv.business_id ?? inv.merchantId ?? 0,
      amount: Number(inv.amount ?? inv.total ?? inv.value ?? 0),
      phone: inv.phone ?? inv.msisdn ?? null,
      created_at: inv.created_at ?? inv.date ?? inv.timestamp ?? null,
      ...inv,
    }));

    // If no invoices return an empty structured response
    if (!invoices.length) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        invoices: [],
        totalPoints: 0,
        perBusiness: {},
      }));
      return;
    }

    // 2) Compute points per invoice using point rules per business
    const perBusiness: Record<string, { totalPoints: number; invoices: any[]; tier: TierRow | null; tiers: TierRow[] }> = {};
    let grandTotalPoints = 0;

    const rulesCache: Record<number, PointRuleRow[]> = {};
    const tiersCache: Record<number, TierRow[]> = {};

    for (const inv of invoices) {
      const businessId = Number(inv.businessId ?? inv.business_id ?? 0) || 0;
      if (!businessId) {
        if (!perBusiness["unknown"]) perBusiness["unknown"] = { totalPoints: 0, invoices: [], tier: null, tiers: [] };
        perBusiness["unknown"].invoices.push({ ...inv, points: 0, applied: [] });
        continue;
      }

      if (!rulesCache[businessId]) rulesCache[businessId] = await loadPointRulesForBusiness(businessId);
      if (!tiersCache[businessId]) tiersCache[businessId] = await loadTiersForBusiness(businessId);

      const rules = rulesCache[businessId] || [];
      const { points, applied } = evaluateRules(inv.amount, rules, 0);

      grandTotalPoints += points;

      if (!perBusiness[businessId]) perBusiness[businessId] = { totalPoints: 0, invoices: [], tier: null, tiers: tiersCache[businessId] ?? [] };
      perBusiness[businessId].totalPoints += points;
      perBusiness[businessId].invoices.push({ ...inv, points, applied });
    }

    // 3) Determine tiers for each business
    for (const bid of Object.keys(perBusiness)) {
      const pb = perBusiness[bid];
      const tiers = pb.tiers || [];
      pb.tier = findTierForPoints(tiers, pb.totalPoints);
    }

    const out = {
      invoices,
      totalPoints: grandTotalPoints,
      perBusiness,
    };

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  } catch (err: any) {
    console.error("[getCustomerDetails] error:", err?.message ?? err);
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err?.message ?? "Server error" };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}

export async function getClientInvoices2(req: IncomingMessage & { body?: any; headers?: any }, res: ServerResponse) {
  try {
    const authHeader = (req.headers?.authorization || req.headers?.Authorization || "") as string;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Missing Authorization token" }));
      return;
    }

    const client = makeCollectoClient();
    // forward body filters, but we still attach the token header
    const body = req.body || {};
    const response = await client.post("/getInvoices", body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(JSON.stringify(response.data));
  } catch (err: any) {
    console.error("[getClientInvoices] error:", err?.message ?? err);
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err?.message ?? "Server error" };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}
