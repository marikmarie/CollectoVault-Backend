"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPointRulesForBusiness = loadPointRulesForBusiness;
exports.loadTiersForBusiness = loadTiersForBusiness;
exports.evaluateRules = evaluateRules;
exports.findTierForPoints = findTierForPoints;
exports.fetchInvoicesFromCollecto = fetchInvoicesFromCollecto;
exports.getClientInvoices = getClientInvoices;
exports.getCustomerDetails = getCustomerDetails;
exports.getClientInvoices2 = getClientInvoices2;
const connection_1 = require("../db/connection");
const collectoAuth_1 = require("./collectoAuth");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/* ----- DB helpers ----- */
async function loadPointRulesForBusiness(businessId) {
    const q = `SELECT id, business_id, name, type, params, priority FROM point_rule WHERE business_id = ? ORDER BY priority ASC`;
    const [rows] = await connection_1.pool.query(q, [businessId]);
    return rows;
}
async function loadTiersForBusiness(businessId) {
    const q = `SELECT id, business_id, name, min_points, benefits FROM tier_rule WHERE business_id = ? ORDER BY min_points ASC`;
    const [rows] = await connection_1.pool.query(q, [businessId]);
    return rows;
}
/* ----- Rule evaluation ----- */
function evaluateRules(amount, rules, basePoints = 0) {
    let totalPoints = basePoints;
    const applied = [];
    for (const r of rules) {
        let params = r.params;
        if (typeof params === "string" && params.length) {
            try {
                params = JSON.parse(params);
            }
            catch {
                params = {};
            }
        }
        params = params || {};
        let pts = 0;
        switch (r.type) {
            case "per_amount": {
                const per = Number(params.per ?? 100);
                const pointsPer = Number(params.points ?? 1);
                if (per > 0)
                    pts = Math.floor(amount / per) * pointsPer;
                break;
            }
            case "fixed": {
                pts = Number(params.points ?? 0);
                break;
            }
            case "multiplier": {
                const mult = Number(params.multiplier ?? 1);
                pts = Math.floor((totalPoints + basePoints) * (mult - 1));
                break;
            }
            case "campaign": {
                const now = new Date();
                const start = params.start ? new Date(params.start) : null;
                const end = params.end ? new Date(params.end) : null;
                if ((!start || now >= start) && (!end || now <= end)) {
                    pts = Number(params.extra_points ?? 0);
                }
                break;
            }
            default:
                pts = 0;
        }
        if (pts > 0) {
            applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
            totalPoints += pts;
        }
    }
    return { points: totalPoints, applied };
}
/* ----- Tier helper ----- */
function findTierForPoints(tiers, totalPoints) {
    if (!tiers || tiers.length === 0)
        return null;
    const sorted = tiers.slice().sort((a, b) => a.min_points - b.min_points);
    let matched = null;
    for (const t of sorted) {
        if (totalPoints >= Number(t.min_points))
            matched = t;
        else
            break;
    }
    return matched;
}
/* ----- Utility: extract vault token from headers ----- */
function extractVaultTokenFromReq(req) {
    const headers = req.headers || {};
    // Accept Authorization: Bearer <token> OR custom header vaultOtpToken (case-insensitive)
    let token = "";
    if (typeof headers.authorization === "string" && headers.authorization.trim().length) {
        token = headers.authorization.replace(/^Bearer\s+/i, "").trim();
    }
    if (!token) {
        // check a few header name variations
        token = (headers["vaultOtpToken"] || headers["vaultotpToken"] || headers["vaultotptoken"] || headers["x-vault-otptoken"] || "");
        if (typeof token !== "string")
            token = "";
    }
    return token || null;
}
/* ----- Shared helper: fetch invoices from Collecto (returns data) ----- */
async function fetchInvoicesFromCollecto(token, body = {}) {
    if (!token)
        throw new Error("Missing token");
    const client = (0, collectoAuth_1.makeCollectoClient)();
    // include the vault token as Authorization header when requesting Collecto
    // (Collecto should accept this token and identify the customer)
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    // Use POST because many collecto endpoints expect POST with payload (adjust if yours expects GET)
    const r = await client.post("/getInvoices", body, { headers });
    return r.data;
}
/* ----- Handler: getClientInvoices (API endpoint) ----- */
async function getClientInvoices(req, res) {
    try {
        const token = extractVaultTokenFromReq(req);
        if (!token) {
            res.writeHead(401, { "content-type": "application/json" });
            res.end(JSON.stringify({ message: "Missing vault token" }));
            return;
        }
        const body = req.body || {};
        const data = await fetchInvoicesFromCollecto(token, body);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
    }
    catch (err) {
        console.error("[getClientInvoices] error:", err?.message ?? err);
        const status = err?.response?.status ?? 500;
        const payload = err?.response?.data ?? { message: err?.message ?? "Unable to fetch invoices" };
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
    }
}
async function getCustomerDetails(req, res) {
    try {
        const token = extractVaultTokenFromReq(req);
        if (!token) {
            res.writeHead(401, { "content-type": "application/json" });
            res.end(JSON.stringify({ message: "Missing vault token" }));
            return;
        }
        console.log("Fetching customer details with token:", token);
        const body = req.body || {};
        const collectoData = await fetchInvoicesFromCollecto(token, body);
        const invoicesRaw = Array.isArray(collectoData) ? collectoData : (collectoData?.invoices ?? (collectoData?.data ?? []));
        const invoices = invoicesRaw.map((inv) => ({
            transactionId: inv.transactionId ?? inv.id ?? inv.txId ?? inv.reference ?? "",
            business_id: inv.business_id ?? inv.businessId ?? inv.merchantId ?? 0,
            businessId: inv.businessId ?? inv.business_id ?? inv.merchantId ?? 0,
            amount: Number(inv.amount ?? inv.total ?? inv.value ?? 0),
            phone: inv.phone ?? inv.msisdn ?? null,
            created_at: inv.created_at ?? inv.date ?? inv.timestamp ?? null,
            ...inv,
        }));
        if (!invoices.length) {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({
                invoices: [],
                totalPoints: 0,
                perBusiness: {},
            }));
            return;
        }
        // 2) Compute points per invoice using point rules per business
        const perBusiness = {};
        let grandTotalPoints = 0;
        const rulesCache = {};
        const tiersCache = {};
        for (const inv of invoices) {
            const businessId = Number(inv.businessId ?? inv.business_id ?? 0) || 0;
            if (!businessId) {
                if (!perBusiness["unknown"])
                    perBusiness["unknown"] = { totalPoints: 0, invoices: [], tier: null, tiers: [] };
                perBusiness["unknown"].invoices.push({ ...inv, points: 0, applied: [] });
                continue;
            }
            if (!rulesCache[businessId])
                rulesCache[businessId] = await loadPointRulesForBusiness(businessId);
            if (!tiersCache[businessId])
                tiersCache[businessId] = await loadTiersForBusiness(businessId);
            const rules = rulesCache[businessId] || [];
            const { points, applied } = evaluateRules(inv.amount, rules, 0);
            grandTotalPoints += points;
            if (!perBusiness[businessId])
                perBusiness[businessId] = { totalPoints: 0, invoices: [], tier: null, tiers: tiersCache[businessId] ?? [] };
            perBusiness[businessId].totalPoints += points;
            perBusiness[businessId].invoices.push({ ...inv, points, applied });
        }
        // 3) Determine tiers for each business
        for (const bid of Object.keys(perBusiness)) {
            const pb = perBusiness[bid];
            const tiers = pb.tiers || [];
            pb.tier = findTierForPoints(tiers, pb.totalPoints);
        }
        const out = {
            invoices,
            totalPoints: grandTotalPoints,
            perBusiness,
        };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
    }
    catch (err) {
        console.error("[getCustomerDetails] error:", err?.message ?? err);
        const status = err?.response?.status ?? 500;
        const payload = err?.response?.data ?? { message: err?.message ?? "Server error" };
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
    }
}
async function getClientInvoices2(req, res) {
    try {
        const authHeader = (req.headers?.authorization || req.headers?.Authorization || "");
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
            res.writeHead(401, { "content-type": "application/json" });
            res.end(JSON.stringify({ message: "Missing Authorization token" }));
            return;
        }
        const client = (0, collectoAuth_1.makeCollectoClient)();
        // forward body filters, but we still attach the token header
        const body = req.body || {};
        const response = await client.post("/getInvoices", body, {
            headers: { Authorization: `Bearer ${token}` },
        });
        res.writeHead(response.status, { "content-type": "application/json" });
        res.end(JSON.stringify(response.data));
    }
    catch (err) {
        console.error("[getClientInvoices] error:", err?.message ?? err);
        const status = err?.response?.status ?? 500;
        const payload = err?.response?.data ?? { message: err?.message ?? "Server error" };
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
    }
}
