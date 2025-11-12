// src/api/customerDetails.ts
import { IncomingMessage, ServerResponse } from "http";
import { pool } from "../db/connection";
import { makeCollectoClient } from "./collectoAuth"; // you export this in collectoAuth
import dotenv from "dotenv";
dotenv.config();

type Invoice = {
  transactionId: string;
  business_id?: number; // Collecto might use businessId or business_id
  businessId?: number;
  amount: number;
  phone?: string | null;
  created_at?: string;
  [k: string]: any;
};

export type PointRuleRow = {
  id: number;
  business_id: number;
  name: string;
  type: string; // 'per_amount' | 'fixed' | 'multiplier' | 'campaign' etc
  params: any; // JSON column
  priority: number;
};

export type TierRow = {
  id: number;
  business_id: number;
  name: string;
  min_points: number;
  benefits?: any;
};

/**
 * Load point rules for a business (ordered by priority ASC)
 */
export async function loadPointRulesForBusiness(businessId: number): Promise<PointRuleRow[]> {
  const q = `SELECT id, business_id, name, type, params, priority FROM point_rule WHERE business_id = ? ORDER BY priority ASC`;
  const [rows] = await pool.query(q, [businessId]);
  return (rows as any) as PointRuleRow[];
}

/**
 * Load tiers for a business ordered by min_points ascending
 */
export async function loadTiersForBusiness(businessId: number): Promise<TierRow[]> {
  const q = `SELECT id, business_id, name, min_points, benefits FROM tier_rule WHERE business_id = ? ORDER BY min_points ASC`;
  const [rows] = await pool.query(q, [businessId]);
  return (rows as any) as TierRow[];
}

/**
 * Evaluate rules for a single invoice amount.
 * Returns { points, applied } where applied is an array of applied rule details.
 *
 * Rules supported:
 * - per_amount: params { per: number, points: number }
 * - fixed: params { points: number }
 * - multiplier: params { multiplier: number } // multiplies basePoints (if provided) — here we consider multiplier applied to running total
 * - campaign: params { start?: ISO, end?: ISO, extra_points: number }
 *
 * You can extend this to other rule types later.
 */
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
        // multiplier applies to the running total (or basePoints)
        const mult = Number(params.multiplier ?? 1);
        // additional points = floor((totalPoints + basePoints) * (mult - 1))
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
      default: {
        // unknown rule type — skip
        pts = 0;
      }
    }

    if (pts > 0) {
      applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
      totalPoints += pts;
    }
  }

  return { points: totalPoints, applied };
}

/**
 * Helper: determine the best tier for totalPoints (pick tier with largest min_points <= totalPoints)
 */
export function findTierForPoints(tiers: TierRow[], totalPoints: number): TierRow | null {
  if (!tiers || tiers.length === 0) return null;
  // ensure sorted ascending by min_points
  const sorted = tiers.slice().sort((a, b) => a.min_points - b.min_points);
  let matched: TierRow | null = null;
  for (const t of sorted) {
    if (totalPoints >= Number(t.min_points)) matched = t;
    else break;
  }
  return matched;
}

/**
 * Primary handler: fetch invoices from Collecto, compute points and tiers, return JSON
 *
 * Expected input in req.body:
 * { phone?: string, clientId?: string, collectoId?: string }
 *
 * Response:
 * {
 *   invoices: [ { ...invoice, points: number, applied: [] } ],
 *   totalPoints: number,
 *   perBusiness: {
 *      [businessId]: { totalPoints: number, tier: TierRow | null, tiers: TierRow[] }
 *   }
 * }
 */
export async function getCustomerDetails(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const payload = req.body || {};
    const { phone, clientId, collectoId } = payload;

    if (!phone && !clientId) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "phone or clientId is required" }));
      return;
    }

    // Call Collecto invoices endpoint.
    // NOTE: adjust path & parameters to match your Collecto API contract. Many collecto APIs accept GET /invoices?phone=...
    const client = makeCollectoClient();

    // Build query. Use GET with query params when possible to let Collecto filter server-side.
    const params: any = {};
    if (phone) params.phone = phone;
    if (clientId) params.clientId = clientId;
    if (collectoId) params.collectoId = collectoId;

    // If Collecto expects POST, change to client.post('/invoices', params)
    const r = await client.get("/invoices", { params });

    const data = (r as any)?.data;
    const invoicesRaw = Array.isArray(data) ? (data as any[]) : (data?.invoices ?? []);
    // Normalize invoices into our Invoice type
    const invoices: Invoice[] = invoicesRaw.map((inv: any) => ({
      transactionId: inv.transactionId ?? inv.id ?? inv.txId ?? inv.reference ?? "",
      business_id: inv.business_id ?? inv.businessId ?? inv.business_id,
      businessId: inv.businessId ?? inv.business_id,
      amount: Number(inv.amount ?? inv.total ?? inv.value ?? 0),
      phone: inv.phone ?? inv.msisdn ?? null,
      created_at: inv.created_at ?? inv.date ?? inv.timestamp ?? null,
      ...inv,
    }));

    // If no invoices return empty response
    if (!invoices.length) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        invoices: [],
        totalPoints: 0,
        perBusiness: {},
      }));
      return;
    }

    // For each invoice, compute points by loading rules for the invoice business
    const perBusiness: Record<string, { totalPoints: number; invoices: any[]; tier: TierRow | null; tiers: TierRow[] }> = {};
    let grandTotalPoints = 0;

    // Cache rules & tiers per business to avoid repeated DB calls
    const rulesCache: Record<number, PointRuleRow[]> = {};
    const tiersCache: Record<number, TierRow[]> = {};

    for (const inv of invoices) {
      const businessId = Number(inv.businessId ?? inv.business_id ?? 0) || 0;
      if (!businessId) {
        // If business id not provided, skip points calculation for this invoice
        // But still include invoice in response
        if (!perBusiness["unknown"]) perBusiness["unknown"] = { totalPoints: 0, invoices: [], tier: null, tiers: [] };
        perBusiness["unknown"].invoices.push({ ...inv, points: 0, applied: [] });
        continue;
      }

      if (!rulesCache[businessId]) {
        rulesCache[businessId] = await loadPointRulesForBusiness(businessId);
      }
      if (!tiersCache[businessId]) {
        tiersCache[businessId] = await loadTiersForBusiness(businessId);
      }

      const rules = rulesCache[businessId];
      const { points, applied } = evaluateRules(inv.amount, rules, 0);

      grandTotalPoints += points;

      if (!perBusiness[businessId]) {
        perBusiness[businessId] = { totalPoints: 0, invoices: [], tier: null, tiers: tiersCache[businessId] || [] };
      }
      perBusiness[businessId].totalPoints += points;
      perBusiness[businessId].invoices.push({ ...inv, points, applied });
    }

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
