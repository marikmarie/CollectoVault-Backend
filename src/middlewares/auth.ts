// src/middlewares/auth.ts
import { Req, Res } from "../router";
import { verifyToken } from "../lib/jwt";

export function getAuthUser(req: Req) {
  const auth = (req.headers["authorization"] || "") as string;
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  return payload as any;
}



export function requireAuth(req: Req, res: Res): any {
  const user = getAuthUser(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unauthorized" }));
    return null;
  }
  return user;
}
