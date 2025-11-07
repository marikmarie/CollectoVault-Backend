// top of src/routes/vendor.ts (or wherever vendorRoutes is)
import { Req, Res } from "../router";
import { pool } from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, getAuthUser } from "../middlewares/auth";

// helper response
function send(res: Res, code: number, body: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function vendorRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "GET";
  if (url.startsWith("/api/vendor/services") && method === "POST") {
    const user = getAuthUser(req);
    if (!user || user.role !== "vendor") {
      return send(res, 403, { message: "Only vendors can create services" });
    }

    const body = req.body || {};

    const [result]: any = await pool.query(
      `INSERT INTO collecto_vault_services 
     (vendor_id, title, description, price_points, price_currency, active, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        body.title || null,
        body.description || null,
        body.pricePoints || null,
        body.priceCurrency || null,
        body.active === "false" ? 0 : 1,
        body.image_url || null,
      ]
    );

    send(res, 200, { id: result.insertId, message: "Service created" });
    return;
  }

  if (url.startsWith("/api/vendor/services") && method === "GET") {
    const q = req.query || {};
    const vendorId = q.vendorId || getAuthUser(req)?.id || null;
    const [rows] = await pool.query(
      "SELECT * FROM collecto_vault_services WHERE vendor_id = ?",
      [vendorId]
    );
    send(res, 200, rows);
    return;
  }

  // GET /api/vendor/services/:id
  const matchService = url.match(/^\/api\/vendor\/services\/([^\/\?]+)/);
  if (matchService && method === "GET") {
    const id = matchService[1];
    const [rows] = await pool.query(
      "SELECT * FROM collecto_vault_services WHERE id = ? LIMIT 1",
      [id]
    );
    send(res, 200, (rows as any[])[0] || null);
    return;
  }

  // PUT /api/vendor/services/:id
  if (matchService && method === "PUT") {
    const user = getAuthUser(req);
    if (!user) return send(res, 403, { message: "Unauthorized" });
    const id = matchService[1];
    const body = req.body || {};
    await pool.query(
      "UPDATE collecto_vault_services SET title=?,description=?,price_points=?,price_currency=?,active=?,image_url=? WHERE id=?",
      [
        body.title,
        body.description,
        body.price_points || null,
        body.price_currency || null,
        body.active ? 1 : 0,
        body.image_url || null,
        id,
      ]
    );
    send(res, 200, { message: "Updated" });
    return;
  }

  // DELETE /api/vendor/services/:id
  if (matchService && method === "DELETE") {
    const id = matchService[1];
    await pool.query("DELETE FROM collecto_vault_services WHERE id = ?", [id]);
    send(res, 200, { message: "Deleted" });
    return;
  }

  // POINT RULES: GET/POST/PUT/DELETE at /api/vendor/:vendorId/point-rules
  const matchPR = url.match(
    /^\/api\/vendor\/([^\/]+)\/point-rules(?:\/([^\/]+))?/
  );
  if (matchPR) {
    const vendorId = Number(matchPR[1]);
    const ruleId = matchPR[2];

    // GET RULES
    if (method === "GET") {
      const [rows] = await pool.query(
        "SELECT * FROM collecto_vault_pointrules WHERE vendor_id = ?",
        [vendorId]
      );
      return send(res, 200, rows);
    }

    // Ensure vendor belongs to logged in user
    const user = getAuthUser(req);
    if (!user) return send(res, 401, { message: "Not authenticated" });

    const [rows] = await pool.query(
      "SELECT * FROM collecto_vault_vendors WHERE user_id = ?",
      [user.id]
    );
    const vendorRows = rows as any[];
    const vendor = vendorRows[0];

    if (!vendorRows || vendorRows.length === 0) {
      return send(res, 404, { message: "Vendor not found" });
    }

    if (!vendor || vendor.user_id !== user.id) {
      return send(res, 403, { message: "Only vendor owner can modify rules" });
    }

    // CREATE RULE
    if (method === "POST") {
      const body = req.body || {};
      await pool.query(
        `INSERT INTO collecto_vault_pointrules 
      (vendor_id, name, description, trigger_type, points, multiplier, max_per_transaction, max_per_day, active, start_at, end_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vendorId,
          body.name,
          body.description || null,
          body.trigger || "purchase",
          body.points || 0,
          body.multiplier || null,
          body.max_per_transaction || null,
          body.max_per_day || null,
          body.active ? 1 : 0,
          body.start_at || null,
          body.end_at || null,
        ]
      );
      return send(res, 200, { message: "Rule created successfully" });
    }

    // UPDATE RULE
    if (method === "PUT" && ruleId) {
      const body = req.body || {};
      await pool.query(
        `UPDATE collecto_vault_pointrules SET name=?, description=?, trigger_type=?, points=?, multiplier=?, max_per_transaction=?, max_per_day=?, active=?, start_at=?, end_at=? WHERE id=? AND vendor_id=?`,
        [
          body.name,
          body.description || null,
          body.trigger || "purchase",
          body.points || 0,
          body.multiplier || null,
          body.max_per_transaction || null,
          body.max_per_day || null,
          body.active ? 1 : 0,
          body.start_at || null,
          body.end_at || null,
          ruleId,
          vendorId,
        ]
      );
      return send(res, 200, { message: "Rule updated" });
    }

    // DELETE RULE
    if (method === "DELETE" && ruleId) {
      await pool.query(
        "DELETE FROM collecto_vault_pointrules WHERE id=? AND vendor_id=?",
        [ruleId, vendorId]
      );
      return send(res, 200, { message: "Rule deleted" });
    }
  }

  // // POINT RULES: GET/POST/PUT/DELETE at /api/vendor/:vendorId/point-rules
  // const matchPR = url.match(/^\/api\/vendor\/([^\/]+)\/point-rules(?:\/([^\/]+))?/);
  // if (matchPR) {
  //   const vendorId = matchPR[1];
  //   const ruleId = matchPR[2];
  //   if (method === "GET") {
  //     const [rows] = await pool.query("SELECT * FROM collecto_vault_pointrules WHERE vendor_id = ?", [vendorId]);
  //     send(res, 200, rows);
  //     return;
  //   }
  //   if (method === "POST") {
  //     const user = getAuthUser(req);
  //     if (!user || user.id !== vendorId) return send(res, 403, { message: "Only the vendor owner can create rules" });
  //     const body = req.body || {};
  //     const id = uuidv4();
  //     await pool.query("INSERT INTO collecto_vault_pointrules (id,vendor_id,name,description,trigger,points,multiplier,max_per_transaction,max_per_day,active,start_at,end_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())",
  //       [id, vendorId, body.name, body.description || null, body.trigger || "purchase", body.points || 0, body.multiplier || null, body.max_per_transaction || null, body.max_per_day || null, body.active ? 1 : 1, body.start_at || null, body.end_at || null]);
  //     send(res, 200, { id, message: "Rule created" });
  //     return;
  //   }
  //   if (method === "PUT" && ruleId) {
  //     const body = req.body || {};
  //     await pool.query("UPDATE collecto_vault_pointrules SET name=?,description=?,trigger=?,points=?,multiplier=?,max_per_transaction=?,max_per_day=?,active=?,start_at=?,end_at=? WHERE id=?",
  //       [body.name, body.description || null, body.trigger || "purchase", body.points || 0, body.multiplier || null, body.max_per_transaction || null, body.max_per_day || null, body.active ? 1 : 0, body.start_at || null, body.end_at || null, ruleId]);
  //     send(res, 200, { message: "Updated" });
  //     return;
  //   }
  //   if (method === "DELETE" && ruleId) {
  //     await pool.query("DELETE FROM collecto_vault_pointrules WHERE id = ?", [ruleId]);
  //     send(res, 200, { message: "Deleted" });
  //     return;
  //   }
  // }

  // TIERS: GET/POST/PUT/DELETE /api/vendor/:vendorId/tier-rules
  const matchTier = url.match(
    /^\/api\/vendor\/([^\/]+)\/tier-rules(?:\/([^\/]+))?/
  );
  if (matchTier) {
    const vendorId = matchTier[1];
    const tierId = matchTier[2];
    if (method === "GET") {
      const [rows] = await pool.query(
        "SELECT * FROM collecto_vault_tiers WHERE vendor_id = ? ORDER BY min_points ASC",
        [vendorId]
      );
      send(res, 200, rows);
      return;
    }
    if (method === "POST") {
      const body = req.body || {};
      await pool.query(
        "INSERT INTO collecto_vault_tiers (vendor_id,name,min_points,color,badge_emoji,perks,auto_promote,expires_after_days,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,NOW())",
        [
          vendorId,
          body.name,
          body.min_points || 0,
          body.color || null,
          body.badge_emoji || null,
          JSON.stringify(body.perks || []),
          body.auto_promote ? 1 : 0,
          body.expires_after_days || null,
        ]
      );
      send(res, 200, { id: vendorId, message: "Tier created" });
      return;
    }
    if (method === "PUT" && tierId) {
      const body = req.body || {};
      await pool.query(
        "UPDATE collecto_vault_tiers SET name=?,min_points=?,color=?,badge_emoji=?,perks=?,auto_promote=?,expires_after_days=?,active=? WHERE id=?",
        [
          body.name,
          body.min_points || 0,
          body.color || null,
          body.badge_emoji || null,
          JSON.stringify(body.perks || []),
          body.auto_promote ? 1 : 0,
          body.expires_after_days || null,
          body.active ? 1 : 0,
          tierId,
        ]
      );
      send(res, 200, { message: "Updated" });
      return;
    }
    if (method === "DELETE" && tierId) {
      await pool.query("DELETE FROM collecto_vault_tiers WHERE id = ?", [
        tierId,
      ]);
      send(res, 200, { message: "Deleted" });
      return;
    }
  }

  // not found for vendor group
  send(res, 404, { message: "vendor route not found" });
}
