import { Req, Res } from "../router";
import { pool } from "../db/connection";
import { hashPassword, verifyPassword } from "../lib/hash";
import { signToken } from "../lib/jwt";
import { v4 as uuidv4 } from "uuid";

function ok(res: Res, data: any) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export async function authRoutes(req: Req, res: Res) {
  const url = req.url || "";
  const method = req.method || "GET";

  if (url.startsWith("/api/auth/register") && method === "POST") {
    const body = req.body || {};
    // required: email, password, name
    if (!body.email || !body.password || !body.name ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "email, password and name required" }));
      return;
    }

    const id = uuidv4();
    try {
      const password_hash = await hashPassword(body.password);
      await pool.query(
        "INSERT INTO collecto_vault_users (id,email,password_hash,name,role,points,created_at) VALUES (?,?,?,?,?,0,NOW())",
        [id, body.email, password_hash, body.name, body.role || "customer"]
      );
      const token = signToken({ id, email: body.email, role: body.role || "customer" });
      ok(res, { id, email: body.email, name: body.name, role: body.role || "customer", token });
    } catch (err: any) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Registration failed", error: String(err) }));
    }
    return;
  }

  if (url.startsWith("/api/auth/login") && method === "POST") {
    const body = req.body || {};
    if (!body.email || !body.password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "email and password required" }));
      return;
    }
    try {
      const [rows] = await pool.query("SELECT * FROM collecto_vault_users WHERE email = ? LIMIT 1", [body.email]);
      const user = (rows as any[])[0];
      if (!user) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Invalid credentials" }));
        return;
      }
      const okpw = await verifyPassword(body.password, user.password_hash);
      if (!okpw) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Invalid credentials" }));
        return;
      }
      const token = signToken({ id: user.id, email: user.email, role: user.role });
      ok(res, { id: user.id, email: user.email, name: user.name, role: user.role, points: user.points || 0, token });
    } catch (err: any) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Login failed", error: String(err) }));
    }
    return;
  }

  if (url.startsWith("/api/auth/me") && method === "GET") {
    const auth = (req.headers["authorization"] || "") as string;
    if (!auth.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }
    const token = auth.slice(7);
    const payload = require("../lib/jwt").verifyToken(token);
    if (!payload) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid token" }));
      return;
    }
    const userId = (payload as any).id;
    const [rows] = await pool.query("SELECT id,email,name,role,points,avatar_url FROM collecto_vault_users WHERE id = ? LIMIT 1", [userId]);
    const user = (rows as any[])[0];
    if (!user) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Not found" }));
      return;
    }
    ok(res, user);
    return;
  }

  // default not found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "auth route not found" }));
}
