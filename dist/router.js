"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = router;
const url_1 = require("url");
const body_1 = require("./utils/body");
// import { transactionRoutes } from "./routes/transactions";
// import { collectoRoutes } from "./routes/collecto";
const collectoAuth_1 = require("./api/collectoAuth");
const BuyPoints_1 = require("./api/BuyPoints");
const pointRules_1 = require("./api/pointRules");
const tierRules_1 = require("../src/api/tierRules");
const customers_1 = require("./api/customers");
async function router(req, res) {
    const url = (0, url_1.parse)(req.url || "", true);
    req.query = url.query || {};
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "")) {
        try {
            req.body = await (0, body_1.jsonBody)(req);
        }
        catch (e) {
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
        return (0, collectoAuth_1.handleCollectoAuth)(req, res);
    if (req.method === 'POST' && req.url === '/api/collecto/authVerify')
        return (0, collectoAuth_1.handleCollectoAuthVerify)(req, res);
    if (req.method === 'POST' && req.url === '/api/buy-points')
        return (0, BuyPoints_1.buyPointsRequest)(req, res);
    if (req.method === 'GET' && req.url === '/api/customer/me')
        return (0, customers_1.getCustomerDetails)(req, res);
    //if (req.method === 'GET' && req.url === '/api/customer/rewards') return handleTierRules(req, res);
    if (req.method === 'GET' && req.url === '/api/customer/invoices')
        return (0, customers_1.getClientInvoices)(req, res);
    //if (req.method === 'GET' && req.url === '/api/customer/tier') return getTierRules(req, res);
    if (req.method === 'POST' && req.url === '/api/point-packages')
        return (0, BuyPoints_1.handleCreatePointPackage)(req, res);
    if (req.method === 'GET' && req.url === '/api/point-packages')
        return (0, BuyPoints_1.handleListPointPackages)(req, res);
    if (req.method === 'POST' && req.url === '/point-rules')
        return (0, pointRules_1.handleCreatePointRule)(req, res);
    if (req.method === 'GET' && req.url === '/point-rules')
        return (0, pointRules_1.handleListPointRules)(req, res);
    if (req.method === 'POST' && req.url === '/tier-rules')
        return (0, tierRules_1.handleCreateTierRule)(req, res);
    if (req.method === 'GET' && req.url === '/tier-rules')
        return (0, tierRules_1.handleListTierRules)(req, res);
    if (req.method === 'GET' && req.url === '/tier-rules')
        return (0, tierRules_1.handleListTierRules)(req, res);
    // // Rewards
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "API route not found" }));
}
