// import { Req, Res } from "../router";
// import { pool } from "../db/connection";
// import { hashPassword, verifyPassword } from "../lib/hash";
// import { signToken } from "../lib/jwt";


// function ok(res: Res, data: any) {
//   res.setHeader("Content-Type", "application/json; charset=utf-8");
//   res.writeHead(200);
//   res.end(JSON.stringify(data));
// }

// export async function authRoutes(req: Req, res: Res) {
//   const url = req.url || "";
//   const method = req.method || "GET";

//   if (url.startsWith("/api/auth/register") && method === "POST") {
//     const body = req.body || {};
//     if (!body.email || !body.password || !body.name || !body.role) {
//       return send400(res, "email, password, name and role required");
//     }

//     try {
//       const password_hash = await hashPassword(body.password);

//       // 1. INSERT USER
//       const [result]: any = await pool.query(
//         "INSERT INTO collecto_vault_users (email,password_hash,name,role,phone,created_at) VALUES (?,?,?,?,?,NOW())",
//         [body.email, password_hash, body.name, body.role, body.phone || null]
//       );

//       const userId = result.insertId; 

//       // 2. INSERT INTO customer OR vendor table
//       if (body.role === "customer") {
//         await pool.query(
//           "INSERT INTO collecto_vault_customers (user_id) VALUES (?)",
//           [userId]
//         );
//       } else if (body.role === "vendor") {
//         await pool.query(
//           "INSERT INTO collecto_vault_vendors (user_id, business_name) VALUES (?,?)",
//           [userId, body.business_name || null]
//         );
//       }

//       const token = signToken({
//         id: userId,
//         email: body.email,
//         role: body.role,
//       });
//       ok(res, {
//         id: userId,
//         name: body.name,
//         email: body.email,
//         role: body.role,
//         token,
//       });
//     } catch (err) {
//       console.error(err);
//       send500(res, "Registration failed");
//     }
//   }

//   if (url.startsWith("/api/auth/login") && method === "POST") {
//     const body = req.body || {};
//     if (!body.email || !body.password) {
//       res.writeHead(400, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: "email and password required" }));
//       return;
//     }
//     try {
//       const [rows] = await pool.query(
//         "SELECT * FROM collecto_vault_users WHERE email = ? LIMIT 1",
//         [body.email]
//       );
//       const user = (rows as any[])[0];
//       if (!user) {
//         res.writeHead(401, { "Content-Type": "application/json" });
//         res.end(JSON.stringify({ message: "Invalid credentials" }));
//         return;
//       }
//       const okpw = await verifyPassword(body.password, user.password_hash);
//       if (!okpw) {
//         res.writeHead(401, { "Content-Type": "application/json" });
//         res.end(JSON.stringify({ message: "Invalid credentials" }));
//         return;
//       }
//       const token = signToken({
//         id: user.id,
//         email: user.email,
//         role: user.role,
//       });
//       ok(res, {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         role: user.role,
//         points: user.points || 0,
//         token,
//       });
//     } catch (err: any) {
//       console.error(err);
//       res.writeHead(500, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: "Login failed", error: String(err) }));
//     }
//     return;
//   }

//   if (url.startsWith("/api/auth/me") && method === "GET") {
//     const auth = (req.headers["authorization"] || "") as string;
//     if (!auth.startsWith("Bearer ")) {
//       res.writeHead(401, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: "Unauthorized" }));
//       return;
//     }
//     const token = auth.slice(7);
//     const payload = require("../lib/jwt").verifyToken(token);
//     if (!payload) {
//       res.writeHead(401, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: "Invalid token" }));
//       return;
//     }
//     const userId = (payload as any).id;
//     const [rows] = await pool.query(
//       "SELECT id,email,name,role,avatar_url FROM collecto_vault_users WHERE id = ? LIMIT 1",
//       [userId]
//     );
//     const user = (rows as any[])[0];
//     if (!user) {
//       res.writeHead(404, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ message: "Not found" }));
//       return;
//     }
//     ok(res, user);
//     return;
//   }

//   function send400(res: Res, message: string) {
//     res.setHeader("Content-Type", "application/json; charset=utf-8");
//     res.writeHead(400);
//     res.end(JSON.stringify({ message }));
//   }

//   function send500(res: Res, message: string) {
//     res.setHeader("Content-Type", "application/json; charset=utf-8");
//     res.writeHead(500);
//     res.end(JSON.stringify({ message }));
//   }
//   // default not found
//   res.writeHead(404, { "Content-Type": "application/json" });
//   res.end(JSON.stringify({ message: "auth route not found" }));
// }
