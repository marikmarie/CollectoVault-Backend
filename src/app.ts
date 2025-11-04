import http from "http";
import dotenv from "dotenv";
dotenv.config();
import { router } from "./router";
const PORT = Number(process.env.PORT || 5000);

const server = http.createServer(async (req, res) => {
  // add some CORS for local dev and preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    await router(req, res);
  } catch (err: any) {
    console.error("Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Internal server error", error: String(err) }));
  }
});

server.listen(PORT, () => console.log(`CollectoVault API running at http://localhost:${PORT}`));
