import { Req, Res } from "../router";
import { collectoRequestToPay, collectoRequestToPayStatus, collectoServicePayment, collectoServicePaymentStatus } from "../services/collectoClient";

function send(res: Res, code: number, body: any) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function collectoRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "POST";
  if (url.startsWith("/api/collecto/requestToPay") && method === "POST") {
    try { const data = await collectoRequestToPay(req.body || {}); send(res, 200, data); } catch (e:any) { send(res, 500, { error: String(e) }); }
    return;
  }
  if (url.startsWith("/api/collecto/requestToPayStatus") && method === "POST") {
    try { const data = await collectoRequestToPayStatus(req.body || {}); send(res, 200, data); } catch (e:any) { send(res, 500, { error: String(e) }); }
    return;
  }
  if (url.startsWith("/api/collecto/servicePayment") && method === "POST") {
    try { const data = await collectoServicePayment(req.body || {}); send(res, 200, data); } catch (e:any) { send(res, 500, { error: String(e) }); }
    return;
  }
  if (url.startsWith("/api/collecto/servicePaymentStatus") && method === "POST") {
    try { const data = await collectoServicePaymentStatus(req.body || {}); send(res, 200, data); } catch (e:any) { send(res, 500, { error: String(e) }); }
    return;
  }

  send(res, 404, { message: "collecto route not found" });
}
