import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { jsonBody } from "./utils/body";
import { authRoutes } from "./routes/auth";
import { vendorRoutes } from "./routes/vendors";
import { customerRoutes } from "./routes/customers";
// import { transactionRoutes } from "./routes/transactions";
// import { collectoRoutes } from "./routes/collecto";
import { rewardRoutes } from "./routes/rewards";
import { handleCollectoAuth, handleCollectoAuthVerify } from "./api/collectoAuth";
import {buyPointsRequest} from "./api/BuyPoints";

export type Req = IncomingMessage & {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
};
export type Res = ServerResponse;

export async function router(req: Req, res: Res) {

  const url = parse(req.url || "", true);
  req.query = (url.query as Record<string, string>) || {};


  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "")) {
    try {
      req.body = await jsonBody(req);
    } catch (e) {
      req.body = undefined;
    }
  }

  const path = url.pathname || "/";

  if (!path.startsWith("/api")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
    return;
  }

  if (path.startsWith("/api/auth")) return authRoutes(req, res);

  //new endpoints going to collecto
  if (req.method === 'POST' && req.url === '/api/collecto/auth') 
    return handleCollectoAuth(req, res);
  if (req.method === 'POST' && req.url === '/api/collecto/authVerify') 
    return handleCollectoAuthVerify(req, res);
  if (req.method === 'POST' && req.url === '/api/collecto/buy-points') 
    return buyPointsRequest(req, res);

  if (path.startsWith("/api/vendor")) return vendorRoutes(req, res);
  if (path.startsWith("/api/customers")) return customerRoutes(req, res);
  // if (path.startsWith("/api/transactions")) return transactionRoutes(req, res);
  // if (path.startsWith("/api/collecto")) return collectoRoutes(req, res);
  // // Rewards
  if (path.startsWith("/api/rewards")) return rewardRoutes(req, res);

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "API route not found" }));
}
