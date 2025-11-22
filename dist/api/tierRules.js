"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateTierRule = handleCreateTierRule;
exports.handleListTierRules = handleListTierRules;
exports.getTierRules = getTierRules;
const db_vault_1 = __importDefault(require("../db/db_vault"));
const _utils_1 = require("./_utils");
async function handleCreateTierRule(req, res) {
    try {
        const body = await (0, _utils_1.readJSON)(req);
        const business_id = Number(body.business_id);
        const name = String(body.name);
        const min_points = Number(body.min_points);
        const benefits = body.benefits ?? {};
        const [result] = await db_vault_1.default.query(`INSERT INTO collecto_vault_tier_rule (business_id, name, min_points, benefits)
       VALUES (?, ?, ?, ?)`, [business_id, name, min_points, JSON.stringify(benefits)]);
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, insertId: result.insertId }));
    }
    catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
    }
}
async function handleListTierRules(req, res) {
    try {
        const [rows] = await db_vault_1.default.query(`SELECT id, business_id, name, min_points, benefits, created_at
       FROM collecto_vault_tier_rule
       ORDER BY created_at DESC`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(rows));
    }
    catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
    }
}
async function getTierRules(req, res) {
    try {
        const [rows] = await db_vault_1.default.query(`SELECT id, business_id, name, min_points, benefits, created_at
       FROM collecto_vault_tier_rule
       ORDER BY created_at DESC`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(rows));
    }
    catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
    }
}
