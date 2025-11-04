import { Req, Res } from "../router";
import { pool } from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser } from "../middlewares/auth";

function send(res: Res, code: number, body: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function customerRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "GET";

  // GET /api/customers/:id
  const matchGet = url.match(/^\/api\/customers\/([^\/\?]+)/);
  if (matchGet && method === "GET") {
    const id = matchGet[1];
    const [rows] = await pool.query("SELECT id,email,name,role,points,avatar_url FROM users WHERE id = ? LIMIT 1", [id]);
    send(res, 200, (rows as any[])[0] || null);
    return;
  }

  // GET /api/customers/:id/rewards  (list rewards available (from services))
  const matchRewards = url.match(/^\/api\/customers\/([^\/]+)\/rewards/);
  if (matchRewards && method === "GET") {
    // for demo, return available services that have price_points
    const [rows] = await pool.query("SELECT s.*, v.business_name FROM services s LEFT JOIN vendors v ON s.vendor_id=v.id WHERE s.price_points IS NOT NULL AND s.active=1");
    send(res, 200, rows);
    return;
  }

  // PUT /api/customers/:id update profile
  if (matchGet && method === "PUT") {
    const id = matchGet[1];
    const body = req.body || {};
    await pool.query("UPDATE users SET name=?, avatar_url=? WHERE id=?", [body.name || null, body.avatar_url || null, id]);
    send(res, 200, { message: "Updated" });
    return;
  }

  send(res, 404, { message: "customer route not found" });
}
