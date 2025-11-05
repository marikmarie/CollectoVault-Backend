// src/routes/rewards.ts
import { Req, Res } from "../router";
import { pool } from "../db/connection";
import { requireAuth } from "../middlewares/auth";

function send(res: Res, code: number, body: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function rewardRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "GET";

  // -------------------------------------------
  // GET /api/rewards/top  (for dashboard)
  // -------------------------------------------
  if (url === "/api/rewards/top" && method === "GET") {
    // return top 6 rewards with points or price options
    const [rows] = await pool.query(
      `SELECT 
          s.id,
          s.name AS title,
          s.description,
          s.price_points AS pointsPrice,
          s.price_currency AS currencyPrice,
          v.business_name AS vendorName,
          s.image_url AS imageUrl
       FROM collecto_vault_services s
       LEFT JOIN collecto_vault_vendors v ON s.vendor_id = v.id
       WHERE s.active = 1
       ORDER BY s.priority DESC, s.created_at DESC
       LIMIT 6`
    );
    return send(res, 200, rows);
  }

  // -------------------------------------------
  // GET /api/rewards  (full reward listing)
  // -------------------------------------------
  if (url === "/api/rewards" && method === "GET") {
    const [rows] = await pool.query(
      `SELECT 
          s.id,
          s.name AS title,
          s.description,
          s.price_points AS pointsPrice,
          s.price_currency AS currencyPrice,
          v.business_name AS vendorName,
          s.image_url AS imageUrl
       FROM collecto_vault_services s
       LEFT JOIN collecto_vault_vendors v ON s.vendor_id = v.id
       WHERE s.active = 1
       ORDER BY s.priority DESC, s.created_at DESC`
    );
    return send(res, 200, rows);
  }

  // -------------------------------------------
  // POST /api/rewards/redeem  (requires auth)
  // body: { rewardId: string }
  // deduct user points and insert redemption record
  // -------------------------------------------
  if (url === "/api/rewards/redeem" && method === "POST") {
    const user = requireAuth(req, res);
    if (!user) return; // stops here if not authenticated

    const { rewardId } = req.body || {};
    if (!rewardId) return send(res, 400, { message: "Missing rewardId" });

    // Get reward
    const [rows] = await pool.query(
      `SELECT id, price_points FROM collecto_vault_services WHERE id=? AND active=1 LIMIT 1`,
      [rewardId]
    );
    const [reward] = rows as any[];

    if (!reward) return send(res, 404, { message: "Reward not found" });

    // Get user points
    const [customerRows] = await pool.query(
      `SELECT id, points FROM collecto_vault_users WHERE id=? LIMIT 1`,
      [user.id]
    ) as [import('mysql2').RowDataPacket[], any];

    const customer = customerRows[0];

    if (!customer) return send(res, 404, { message: "User not found" });

    if (customer.points < reward.price_points)
      return send(res, 400, { message: "Not enough points" });

    // Deduct points & record redemption
    await pool.query(
      `UPDATE collecto_vault_users SET points = points - ? WHERE id=?`,
      [reward.price_points, user.id]
    );

    await pool.query(
      `INSERT INTO collecto_vault_redemptions (id, user_id, reward_id) VALUES (UUID(), ?, ?)`,
      [user.id, rewardId]
    );

    return send(res, 200, { message: "Reward redeemed successfully" });
  }

  send(res, 404, { message: "rewards route not found" });
}
