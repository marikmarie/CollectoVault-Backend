// src/api/customerDetails.ts
import { IncomingMessage, ServerResponse } from "http";
import { makeCollectoClient } from "./collectoAuth";
import { pool } from "../db/connection";

type PointRuleRow = {
  id: number;
  business_id: number;
  name: string;
  type: string;
  params: any; // JSON string in DB or already object
  priority?: number;
};

type TierRow = {
  id: number;
  business_id: number;
  name: string;
  min_points: number;
  benefits?: any;
};

/**
 * GET / POST /api/customer/details
 *
 * Expects in req.body one of:
 *  - { phone: "2567..." }   // preferred -- fetch invoices by phone from Collecto
 *  - { customerId: "..."}   // or an internal customer id that you map to phone
 *
 * Returns:
 * {
 *   invoices: [...],
 *   totalPoints: number,
 *   pointsByInvoice: { [transactionId]: number },
 *   tier: { id, name, min_points } | null
 * }
 */
export async function buyPointsRequest(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const body = req.body || {};
    const phone = body.phone;
    const customerId = body.customerId;

    if (!phone && !customerId) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Missing phone or customerId in request body" }));
      return;
    }

    // 1) fetch invoices from Collecto
    const collecto = makeCollectoClient();
    // adapt payload to the Collecto endpoint you implemented
    const fetchPayload = phone ? { phone } : { customerId };
    const invoicesResp = await collecto.post("/getInvoices", fetchPayload);
    const data = (invoicesResp as any)?.data ?? {};
    const invoices: any[] = Array.isArray(data) ? data : (data.invoices ?? []);

    // 2) group invoices by business (business_id or businessId)
    const byBusiness = new Map<number, any[]>();
    for (const inv of invoices) {
      // be flexible in field names
      const bId = Number(inv.business_id ?? inv.businessId ?? inv.vendorId ?? 0) || 0;
      const txAmount = Number(inv.amount ?? inv.total ?? inv.value ?? 0) || 0;
      inv._amount = txAmount; // normalize
      inv._transactionId = String(inv.transactionId ?? inv.tx_id ?? inv.id ?? "");
      if (!byBusiness.has(bId)) byBusiness.set(bId, []);
      byBusiness.get(bId)!.push(inv);
    }

    // 3) load rules per business and evaluate points
    const pointsByInvoice: Record<string, number> = {};
    let totalPoints = 0;

    for (const [businessId, invs] of byBusiness.entries()) {
      // load point rules for this business
      const rules = await loadPointRulesForBusiness(businessId);
      for (const inv of invs) {
        const ptsResult = evaluateRules(inv._amount, rules);
        pointsByInvoice[inv._transactionId] = ptsResult.points;
        totalPoints += ptsResult.points;
      }
    }

    // 4) determine tier based on totalPoints
    // We'll fetch the highest tier whose min_points <= totalPoints. Fall back to null.
    // If all rules/tier are global per business, you may adapt to business-specific tiering.
    const tier = await getTierForPoints(totalPoints);

    // 5) respond with curated payload
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      invoices,
      totalPoints,
      pointsByInvoice,
      tier,
    }));
  } catch (err: any) {
    console.error("[getCustomerDetails] error:", err?.message ?? err);
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err?.message ?? "Internal server error" };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}

/** load point rules for a business from the vault DB */
export async function loadPointRulesForBusiness(businessId: number): Promise<PointRuleRow[]> {
  // try the table names that exist in your schema; adjust if needed.
  const q = `SELECT id, business_id, name, type, params, priority FROM collecto_vault_pointrule WHERE business_id = ? ORDER BY priority ASC`;
  try {
    const [rows] = await pool.query(q, [businessId]);
    // convert params field from JSON string if necessary
    return (rows as any[]).map((r: any) => ({
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      type: r.type,
      params: typeof r.params === "string" ? JSON.parse(r.params || "{}") : (r.params ?? {}),
      priority: r.priority ?? 100,
    }));
  } catch (e) {
    // if your table name differs, attempt fallback to `point_rule`
    const [rows] = await pool.query(`SELECT id, business_id, name, type, params, priority FROM point_rule WHERE business_id = ? ORDER BY priority ASC`, [businessId]);
    return (rows as any[]).map((r: any) => ({
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      type: r.type,
      params: typeof r.params === "string" ? JSON.parse(r.params || "{}") : (r.params ?? {}),
      priority: r.priority ?? 100,
    }));
  }
}

/** Evaluate point rules for an amount. Returns {points, applied} */
export function evaluateRules(amount: number, rules: PointRuleRow[]) {
  let totalPoints = 0;
  const applied: any[] = [];

  for (const r of rules) {
    const params = r.params ?? {};
    let pts = 0;

    switch (r.type) {
      case "per_amount": {
        const per = Number(params.per ?? 100);
        const pointsPer = Number(params.points ?? 1);
        pts = Math.floor(amount / per) * pointsPer;
        break;
      }
      case "fixed": {
        pts = Number(params.points ?? 0);
        break;
      }
      case "multiplier": {
        // multiplier applies to current totalPoints (e.g. 1.2 => +20%)
        const mult = Number(params.multiplier ?? 1);
        pts = Math.floor(totalPoints * (mult - 1));
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
        // unknown rule type - ignore
        break;
    }

    if (pts > 0) {
      applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
      totalPoints += pts;
    }
  }

  return { points: totalPoints, applied };
}

/** Get a tier row for the given totalPoints.
 * Picks the tier with highest min_points <= totalPoints.
 * Returns null if none found.
 */
export async function getTierForPoints(totalPoints: number, businessId?: number): Promise<TierRow | null> {
  try {
    // If tiers are business-specific, include businessId filter.
    const sql = businessId
      ? `SELECT id, business_id, name, min_points, benefits FROM collecto_vault_tierrule WHERE business_id = ? ORDER BY min_points DESC`
      : `SELECT id, business_id, name, min_points, benefits FROM collecto_vault_tierrule ORDER BY min_points DESC`;

    const [rows] = businessId ? await pool.query(sql, [businessId]) : await pool.query(sql);
    const tierRows = (rows as any[]) ?? [];

    for (const t of tierRows) {
      if (Number(t.min_points ?? t.minPoints ?? 0) <= totalPoints) {
        return {
          id: t.id,
          business_id: t.business_id,
          name: t.name,
          min_points: Number(t.min_points ?? t.minPoints ?? 0),
          benefits: t.benefits ? (typeof t.benefits === "string" ? JSON.parse(t.benefits) : t.benefits) : undefined,
        };
      }
    }
    return null;
  } catch (err) {
    // fallback: try alternate table name
    try {
      const [rows] = await pool.query(`SELECT id, business_id, name, min_points, benefits FROM tier_rule ORDER BY min_points DESC`);
      for (const t of (rows as any[])) {
        if (Number(t.min_points ?? 0) <= totalPoints) {
          return { id: t.id, business_id: t.business_id, name: t.name, min_points: Number(t.min_points ?? 0), benefits: t.benefits ?? null };
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }
}
