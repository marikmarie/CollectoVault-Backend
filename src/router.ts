import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { jsonBody } from "./utils/body";
import { authRoutes } from "./routes/auth";
import { vendorRoutes } from "./routes/vendors";
import { customerRoutes } from "./routes/customers";
import { transactionRoutes } from "./routes/transactions";
import { collectoRoutes } from "./routes/collecto";

export type Req = IncomingMessage & { body?: any; params?: Record<string,string>; query?: Record<string,string> };
export type Res = ServerResponse;

export async function router(req: Req, res: Res) {
  // parse url and query
  const url = parse(req.url || "", true);
  req.query = (url.query as Record<string,string>) || {};

  // parse body
  if (["POST","PUT","PATCH","DELETE"].includes(req.method || "")) {
    try { req.body = await jsonBody(req); } catch(e) { req.body = undefined; }
  }

  const path = url.pathname || "/";
  
  if (!path.startsWith("/api")) {
    res.writeHead(404, {"Content-Type":"application/json"});
    res.end(JSON.stringify({ message: "Not found" }));
    return;
  }

  if (path.startsWith("/api/auth")) return authRoutes(req,res);
  if (path.startsWith("/api/vendor")) return vendorRoutes(req,res);
  if (path.startsWith("/api/customers")) return customerRoutes(req,res);
  if (path.startsWith("/api/transactions")) return transactionRoutes(req,res);
  if (path.startsWith("/api/collecto")) return collectoRoutes(req,res);

  res.writeHead(404, {"Content-Type":"application/json"});
  res.end(JSON.stringify({ message: "API route not found" }));

  
}
