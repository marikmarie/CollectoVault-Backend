"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const pointRules_1 = require("./pointRules");
const tierRules_1 = require("./tierRules");
//import { handleEnableLoyalty } from './business';
const collectoAuth_1 = require("./collectoAuth");
dotenv_1.default.config();
const PORT = Number(process.env.PORT ?? 4000);
const server = http_1.default.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/point-rules')
        return (0, pointRules_1.handleCreatePointRule)(req, res);
    if (req.method === 'GET' && req.url === '/point-rules')
        return (0, pointRules_1.handleListPointRules)(req, res);
    if (req.method === 'POST' && req.url === '/tier-rules')
        return (0, tierRules_1.handleCreateTierRule)(req, res);
    if (req.method === 'GET' && req.url === '/tier-rules')
        return (0, tierRules_1.handleListTierRules)(req, res);
    //if (req.method === 'POST' && req.url === '/business/enable') return handleEnableLoyalty(req, res);
    // inside your existing server routing
    // add:
    if (req.method === 'POST' && req.url === '/collecto/auth')
        return (0, collectoAuth_1.handleCollectoAuth)(req, res);
    if (req.method === 'POST' && req.url === '/collecto/authVerify')
        return (0, collectoAuth_1.handleCollectoAuthVerify)(req, res);
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
});
server.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
