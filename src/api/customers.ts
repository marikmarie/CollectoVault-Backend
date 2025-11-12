import { IncomingMessage, ServerResponse } from "http";
import dotenv from "dotenv";
import {makeCollectoClient} from "./collectoAuth";
import { pool } from "../db/connection";
import {handleListPointRules} from "./pointRules"

const COLLECTO_BASE = process.env.COLLECTO_BASE_URL;
const COLLECTO_USERNAME = process.env.COLLECTO_USERNAME;
const COLLECTO_API_KEY = process.env.COLLECTO_API_KEY;

if (!COLLECTO_API_KEY) {
  console.warn("Warning: COLLECTO_API_KEY not set in .env");
}

export async function getCustomerDetails(req: IncomingMessage & { body?: any }, res: ServerResponse){
const invoices = await getClientInvoices(req, res);
if(invoices != null){
  
    const rules = await loadPointRulesForBusiness(invoices);
    const result = evaluateRules(invoices.amount, rules);
  
    try {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `INSERT INTO collecto_vault_transaction (transaction_id, business_id, phone_number, amount, points, rules_applied)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [transactionId, businessId, phone, amount, result.points, JSON.stringify(result.applied)]
        );
  
        await conn.query(
          `INSERT INTO points_balance (business_id, phone_number, total_points)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE total_points = total_points + VALUES(total_points), updated_at = NOW()`,
          [businessId, phone, result.points]
        );
  
        await conn.commit();
        console.log(`[vaultWorker] Processed tx ${transactionId}: +${result.points} points`);
      } catch (err) {
        await conn.rollback();
        //Duplicate
        console.error('[vaultWorker] DB insert failed', err);
        throw err;
      } finally {
        conn.release();
      }
    // const message = `You earned ${result.points} points for your purchase. Transaction: ${transactionId}`;
    //   await sendSms(businessId, phone, message);
  
    } catch (err) {
      console.error('[worker] processing error', err);
      throw err;
    }
}
else{
  return "No invoices.";
}

}

export async function loadPointRulesForBusiness(businessId: number): Promise<PointRuleRow[]> {
  const [rows] = await pool.query('SELECT * FROM collecto_vault_pointrule WHERE business_id = ? ORDER BY priority ASC', [businessId]);
  return (rows as any[]) as PointRuleRow[];
}

export async function getClientInvoices(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  const start = Date.now();
  try {
    const body = req.body || {};
    console.log("[CollectoAuth] body:", body);

    const client = makeCollectoClient();
    const r = await client.get("/invoices", body);
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

export function evaluateRules(amount: number, rules: PointRuleRow[]) {
  let totalPoints = 0;
  const applied: any[] = [];

  for (const r of rules) {
    const params = typeof r.params === 'string' ? JSON.parse(r.params) : r.params;
    let pts = 0;
    if (r.type === 'per_amount') {
      const per = Number(params.per ?? 100);
      const pointsPer = Number(params.points ?? 1);
      pts = Math.floor(amount / per) * pointsPer;
    } else if (r.type === 'fixed') {
      pts = Number(params.points ?? 0);
    } else if (r.type === 'multiplier') {
      const mult = Number(params.multiplier ?? 1);
      pts = Math.floor(totalPoints * (mult - 1));
    } else if (r.type === 'campaign') {
      const now = new Date();
      const start = params.start ? new Date(params.start) : null;
      const end = params.end ? new Date(params.end) : null;
      if ((!start || now >= start) && (!end || now <= end)) {
        pts = Number(params.extra_points ?? 0);
      }
    }
    if (pts > 0) {
      applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
      totalPoints += pts;
    }
  }
  return { points: totalPoints, applied };
}
