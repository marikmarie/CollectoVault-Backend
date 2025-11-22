"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreatePointRule = handleCreatePointRule;
exports.handleListPointRules = handleListPointRules;
const db_vault_1 = __importDefault(require("../db/db_vault"));
const _utils_1 = require("./_utils");
async function handleCreatePointRule(req, res) {
    try {
        const body = await (0, _utils_1.readJSON)(req);
        const business_id = Number(body.business_id);
        const name = String(body.name);
        const type = String(body.type);
        const params = body.params ?? {};
        const priority = body.priority ?? 100;
        const [result] = await db_vault_1.default.query(`INSERT INTO collecto_vault_pointrule (business_id, name, type, params, priority)
       VALUES (?, ?, ?, ?, ?)`, [business_id, name, type, JSON.stringify(params), priority]);
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, insertId: result.insertId }));
    }
    catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
    }
}
async function handleListPointRules(req, res) {
    try {
        const [rows] = await db_vault_1.default.query(`SELECT id, business_id, name, type, params, priority, created_at
       FROM collecto_vault_pointrule
       ORDER BY created_at DESC`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(rows));
    }
    catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
    }
}
