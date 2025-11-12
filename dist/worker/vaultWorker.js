"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_collecto_1 = __importDefault(require("../db/db_collecto"));
const db_vault_1 = __importDefault(require("../db/db_vault"));
const ruleEngine_1 = require("./ruleEngine");
const sms_1 = require("../sms");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const PAGE_LIMIT = 100;
async function getLoyalBusinesses() {
    const [rows] = await db_vault_1.default.query('SELECT id, name FROM collecto_vault_business WHERE loyalty_enabled = 1');
    return rows;
}
async function getCheckpoint(businessId) {
    const [rows] = await db_vault_1.default.query('SELECT last_processed_collecto_tx_id FROM collecto_vault_poll_checkpoint WHERE business_id = ?', [businessId]);
    const r = rows[0];
    return r ? Number(r.last_processed_collecto_tx_id) : 0;
}
async function setCheckpoint(businessId, lastId) {
    await db_vault_1.default.query(`INSERT INTO collecto_vault_poll_checkpoint (business_id, last_processed_collecto_tx_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_processed_collecto_tx_id = VALUES(last_processed_collecto_tx_id), updated_at = NOW()`, [businessId, lastId]);
}
async function fetchCollectoTransactions(businessId, afterId, limit = PAGE_LIMIT) {
    const [rows] = await db_collecto_1.default.query('SELECT id, transaction_id, business_id, amount, phone_number, payload, created_at FROM collecto_transactions WHERE business_id = ? AND id > ? ORDER BY id ASC LIMIT ?', [businessId, afterId, limit]);
    return rows || [];
}
async function processCollectoTx(tx) {
    const phone = tx.phone_number;
    const businessId = tx.business_id;
    const amount = Number(tx.amount);
    const transactionId = String(tx.transaction_id);
    if (!phone) {
        await db_vault_1.default.query(`INSERT INTO unattributed_transaction (business_id, collecto_transaction_id, amount, payload) VALUES (?, ?, ?, ?)`, [businessId, tx.id, amount, JSON.stringify(tx.payload || {})]);
        console.log(`[vaultWorker] Unattributed tx ${transactionId} for business ${businessId}`);
        return;
    }
    const [already] = await db_vault_1.default.query('SELECT id FROM collecto_vault_transaction WHERE transaction_id = ?', [transactionId]);
    if (already.length) {
        console.log('[vaultWorker] already processed', transactionId);
        return;
    }
    const rules = await (0, ruleEngine_1.loadPointRulesForBusiness)(businessId);
    const result = (0, ruleEngine_1.evaluateRules)(amount, rules);
    try {
        const conn = await db_vault_1.default.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(`INSERT INTO collecto_vault_transaction (transaction_id, business_id, phone_number, amount, points, rules_applied)
         VALUES (?, ?, ?, ?, ?, ?)`, [transactionId, businessId, phone, amount, result.points, JSON.stringify(result.applied)]);
            await conn.query(`INSERT INTO points_balance (business_id, phone_number, total_points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE total_points = total_points + VALUES(total_points), updated_at = NOW()`, [businessId, phone, result.points]);
            await conn.commit();
            console.log(`[vaultWorker] Processed tx ${transactionId}: +${result.points} points`);
        }
        catch (err) {
            await conn.rollback();
            //Duplicate
            console.error('[vaultWorker] DB insert failed', err);
            throw err;
        }
        finally {
            conn.release();
        }
        const message = `You earned ${result.points} points for your purchase. Transaction: ${transactionId}`;
        await (0, sms_1.sendSms)(businessId, phone, message);
    }
    catch (err) {
        console.error('[worker] processing error', err);
        throw err;
    }
}
async function processBusiness(businessId) {
    let afterId = await getCheckpoint(businessId);
    while (true) {
        const txs = await fetchCollectoTransactions(businessId, afterId, PAGE_LIMIT);
        if (!txs.length)
            break;
        for (const tx of txs) {
            try {
                await processCollectoTx(tx);
            }
            catch (err) {
                console.error('error processing tx', tx.transaction_id, err);
                return;
            }
            afterId = Number(tx.id);
        }
        await setCheckpoint(businessId, afterId);
        if (txs.length < PAGE_LIMIT)
            break;
    }
}
async function loop() {
    while (true) {
        try {
            const businesses = await getLoyalBusinesses();
            for (const b of businesses) {
                try {
                    await processBusiness(b.id);
                }
                catch (err) {
                    console.error('error processing business', b.id, err);
                }
            }
        }
        catch (err) {
            console.error('worker top-level error', err);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
    }
}
loop().catch((e) => console.error('worker crashed', e));
