import { Req, Res } from "../router";
import { pool } from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser } from "../middlewares/auth";
import { collectoRequestToPay, collectoServicePayment, collectoRequestToPayStatus } from "../services/collectoClient";

function send(res: Res, code: number, body: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// helper to get user
function getUser(req: Req) {
  return getAuthUser(req);
}

export async function transactionRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "POST";
  // POST /api/transactions/buy-points
  if (url.startsWith("/api/transactions/buy-points") && method === "POST") {
    const user = getUser(req);
    if (!user) return send(res, 401, { message: "Unauthorized" });
    const body = req.body || {};
    // required: phone, amount (currency)
    if (!body.phone || !body.amount) return send(res, 400, { message: "phone and amount required" });

    try {
      const reqBody = {
        paymentOption: "mobilemoney",
        phone: body.phone,
        amount: body.amount,
        reference: body.reference || `BuyPoints:${user.id}:${Date.now()}`
      };
      const collectoResp: any = await collectoRequestToPay(reqBody);
      
      const txId = uuidv4();
      await pool.query("INSERT INTO collecto_vault_transactions (id,customer_id,type,points,amount,status,external_tx_id,meta,created_at) VALUES (?,?,?,?,?,?,?,JSON_OBJECT('collecto',? ),NOW())",
        [txId, user.id, "buy_points", body.points || 0, body.amount, "pending", collectoResp.transactionId || collectoResp?.transaction_id || null, JSON.stringify(collectoResp)]);
      return send(res, 200, { message: "Payment requested", transactionId: txId, collecto: collectoResp });
    } catch (err: any) {
      console.error("collecto request failed", err);
      return send(res, 500, { message: "Payment request failed", error: String(err) });
    }
  }

  // POST /api/transactions/buy-points/status  { transactionId: "<collecto transaction id>" }
  if (url.startsWith("/api/transactions/buy-points/status") && method === "POST") {
    const body = req.body || {};
    if (!body.transactionId) return send(res, 400, { message: "transactionId required" });
    try {
      const status: any = await collectoRequestToPayStatus({ transactionId: body.transactionId });
      // if success, update transactions table where external_tx_id = transactionId
      if (status?.status === "success" || status?.status === "paid") {
        // mark all matching tx success (simplest)
        await pool.query("UPDATE collecto_vault_transactions SET status='success' WHERE external_tx_id = ?", [body.transactionId]);
        // add points to user (if stored in meta or points param was included)
        // For demo we attempt to find transaction and add points defined in local transaction table
        const [rows] = await pool.query("SELECT * FROM collecto_vault_transactions WHERE external_tx_id = ? LIMIT 1", [body.transactionId]);
        const tx = (rows as any[])[0];
        if (tx && tx.points && tx.points > 0) {
          await pool.query("UPDATE collecto_vault_users SET points = COALESCE(points,0) + ? WHERE id = ?", [tx.points, tx.customer_id]);
        }
      }
      return send(res, 200, { collectoStatus: status });
    } catch (err: any) {
      console.error(err);
      return send(res, 500, { message: "status check failed", error: String(err) });
    }
  }

  // POST /api/transactions/redeem  { serviceId, customerId (or auth) }
  if (url.startsWith("/api/transactions/redeem") && method === "POST") {
    const user = getUser(req);
    if (!user) return send(res, 401, { message: "Unauthorized" });
    const body = req.body || {};
    if (!body.serviceId) return send(res, 400, { message: "serviceId required" });
    // find service and check customer points
    const [rows] = await pool.query("SELECT * FROM collecto_vault_services WHERE id = ? LIMIT 1", [body.serviceId]);
    const service = (rows as any[])[0];
    if (!service) return send(res, 404, { message: "Service not found" });
    if (!service.price_points) return send(res, 400, { message: "Service is not redeemable by points" });
    // check balance
    const [urows] = await pool.query("SELECT id,points FROM collecto_vault_users WHERE id = ? LIMIT 1", [user.id]);
    const cust = (urows as any[])[0];
    if (!cust) return send(res, 404, { message: "Customer not found" });
    if ((cust.points || 0) < service.price_points) return send(res, 400, { message: "Insufficient points" });
    // deduct points and create transaction
    const txId = uuidv4();
    try {
      await pool.query("INSERT INTO collecto_vault_transactions (id,customer_id,vendor_id,service_id,type,points,amount,status,created_at) VALUES (?,?,?,?,?,?,?,?,NOW())",
        [txId, user.id, service.vendor_id, service.id, "redeem", -1 * Math.abs(service.price_points), service.price_currency || null, "success"]);
      // subtract points
      await pool.query("UPDATE collecto_vault_users SET points = points - ? WHERE id = ?", [service.price_points, user.id]);
      // Optionally call Collecto servicePayment to transfer currency to vendor wallet if needed (skipped unless vendor requires)
      return send(res, 200, { message: "Redeemed", transactionId: txId });
    } catch (err: any) {
      console.error(err);
      return send(res, 500, { message: "Redeem failed", error: String(err) });
    }
  }

  // GET /api/transactions/:customerId
  const matchList = url.match(/^\/api\/transactions\/([^\/\?]+)/);
  if (matchList && req.method === "GET") {
    const customerId = matchList[1];
    const [rows] = await pool.query("SELECT * FROM collecto_vault_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 200", [customerId]);
    return send(res, 200, rows);
  }

  send(res, 404, { message: "transactions route not found" });
}
