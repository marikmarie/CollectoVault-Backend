"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerRoutes = customerRoutes;
const connection_1 = require("../db/connection");
function send(res, code, body) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
async function customerRoutes(req, res) {
    const url = req.url || "";
    const method = req.method || "GET";
    // GET /api/customers/:id
    const matchGet = url.match(/^\/api\/customers\/([^\/\?]+)/);
    if (matchGet && method === "GET") {
        const id = matchGet[1];
        const [rows] = await connection_1.pool.query("SELECT id,email,name,role,points,avatar_url FROM collecto_vault_users WHERE id = ? LIMIT 1", [id]);
        send(res, 200, rows[0] || null);
        return;
    }
    // GET /api/customers/:id/rewards  (list rewards available (from services))
    const matchRewards = url.match(/^\/api\/customers\/([^\/]+)\/rewards/);
    if (matchRewards && method === "GET") {
        // for demo, return available services that have price_points
        const [rows] = await connection_1.pool.query("SELECT s.*, v.business_name FROM collecto_vault_services s LEFT JOIN collecto_vault_vendors v ON s.vendor_id=v.id WHERE s.price_points IS NOT NULL AND s.active=1");
        send(res, 200, rows);
        return;
    }
    // PUT /api/customers/:id update profile
    if (matchGet && method === "PUT") {
        const id = matchGet[1];
        const body = req.body || {};
        await connection_1.pool.query("UPDATE COLLECTO_VAULT_USERS SET name=?, avatar_url=? WHERE id=?", [body.name || null, body.avatar_url || null, id]);
        send(res, 200, { message: "Updated" });
        return;
    }
    send(res, 404, { message: "customer route not found" });
}
