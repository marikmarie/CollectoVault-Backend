"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router_1 = require("./router");
const PORT = Number(process.env.PORT || 5000);
const server = http_1.default.createServer(async (req, res) => {
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
        await (0, router_1.router)(req, res);
    }
    catch (err) {
        console.error("Unhandled error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Internal server error", error: String(err) }));
    }
});
server.listen(PORT, () => console.log(`CollectoVault API running at http://localhost:${PORT}`));
