import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { jsonBody } from "./utils/body";
// import { transactionRoutes } from "./routes/transactions";
// import { collectoRoutes } from "./routes/collecto";

import { handleCollectoAuth, handleCollectoAuthVerify } from "./api/collectoAuth";
import {buyPointsRequest, handleCreatePointPackage,handleListPointPackages} from "./api/BuyPoints";
import { handleCreatePointRule, handleListPointRules } from './api/pointRules';
import { handleCreateTierRule, handleListTierRules } from './api/tierRules';
import {getCustomerDetails, getClientInvoices} from "./api/customers"

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

  if (req.method === 'POST' && req.url === '/api/collecto/auth') 
    return handleCollectoAuth(req, res);
  if (req.method === 'POST' && req.url === '/api/collecto/authVerify') 
    return handleCollectoAuthVerify(req, res);
  if (req.method === 'POST' && req.url === '/api/buy-points') 
    return buyPointsRequest(req, res);

 
  if (req.method === 'GET' && req.url === '/api/customer/me') return getCustomerDetails(req, res);
  //if (req.method === 'GET' && req.url === '/api/customer/rewards') return handleTierRules(req, res);
  if (req.method === 'GET' && req.url === '/api/customer/invoices') return getClientInvoices(req, res);
  //if (req.method === 'GET' && req.url === '/api/customer/tier') return getTierRules(req, res);

  if (req.method === 'POST' && req.url === '/api/point-packages') return handleCreatePointPackage(req, res);
  if (req.method === 'GET' && req.url === '/api/point-packages') return handleListPointPackages(req, res);
 

  if (req.method === 'POST' && req.url === '/api/point-rules') return handleCreatePointRule(req, res);
  if (req.method === 'GET' && req.url === '/api/point-rules') return handleListPointRules(req, res);

  if (req.method === 'POST' && req.url === '/api/tier-rules') return handleCreateTierRule(req, res);
  if (req.method === 'GET' && req.url === '/api/tier-rules') return handleListTierRules(req, res);
  if (req.method === 'GET' && req.url === '/api/tier-rules') return handleListTierRules(req, res);

  
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "API route not found" }));
}
