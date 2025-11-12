"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSms = sendSms;
const db_vault_1 = __importDefault(require("./db/db_vault"));
async function sendSms(businessId, phone, message) {
    const [res] = await db_vault_1.default.query(`INSERT INTO collecto_vault_sms_log (business_id, phone_number, message, status) VALUES (?, ?, ?, ?)`, [businessId, phone, message, 'queued']);
    const insertId = res.insertId;
    await db_vault_1.default.query(`UPDATE collecto_vault_sms_log SET status = 'sent' WHERE id = ?`, [insertId]);
    return { ok: true, id: insertId };
}
