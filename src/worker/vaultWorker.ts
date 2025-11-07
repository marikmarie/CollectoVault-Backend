import collectoDb from '../db_collecto';
import vaultDb from '../db_vault';
import { loadPointRulesForBusiness, evaluateRules } from './ruleEngine';
import { sendSms } from '../sms';
import dotenv from 'dotenv';
dotenv.config();

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const PAGE_LIMIT = 100; // process in batches per business

async function getLoyalBusinesses() {
  const [rows] = await vaultDb.query('SELECT id, name FROM collecto_vault_business WHERE loyalty_enabled = 1');
  return (rows as any[]) as { id: number; name: string }[];
}

async function getCheckpoint(businessId: number) {
  const [rows] = await vaultDb.query('SELECT last_processed_collecto_tx_id FROM collecto_vault_poll_checkpoint WHERE business_id = ?', [businessId]);
  const r = (rows as any[])[0];
  return r ? Number(r.last_processed_collecto_tx_id) : 0;
}

async function setCheckpoint(businessId: number, lastId: number) {
  await vaultDb.query(
    `INSERT INTO collecto_vault_poll_checkpoint (business_id, last_processed_collecto_tx_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_processed_collecto_tx_id = VALUES(last_processed_collecto_tx_id), updated_at = NOW()`,
    [businessId, lastId]
  );
}

async function fetchCollectoTransactions(businessId: number, afterId: number, limit = PAGE_LIMIT) {
  const [rows] = await collectoDb.query(
    'SELECT id, transaction_id, business_id, amount, phone_number, payload, created_at FROM collecto_transactions WHERE business_id = ? AND id > ? ORDER BY id ASC LIMIT ?',
    [businessId, afterId, limit]
  );
  return (rows as any[]) || [];
}

async function processCollectoTx(tx: any) {
  const phone = tx.phone_number;
  const businessId = tx.business_id;
  const amount = Number(tx.amount);
  const transactionId = String(tx.transaction_id);

  if (!phone) {
    // store as unattributed
    await vaultDb.query(
      `INSERT INTO unattributed_transaction (business_id, collecto_transaction_id, amount, payload) VALUES (?, ?, ?, ?)`,
      [businessId, tx.id, amount, JSON.stringify(tx.payload || {})]
    );
    console.log(`[vaultWorker] Unattributed tx ${transactionId} for business ${businessId}`);
    return;
  }

  // Check if already processed (idempotency)
  const [already] = await vaultDb.query('SELECT id FROM collecto_vault_transaction WHERE transaction_id = ?', [transactionId]);
  if ((already as any[]).length) {
    console.log('[vaultWorker] already processed', transactionId);
    return;
  }

  // Evaluate rules
  const rules = await loadPointRulesForBusiness(businessId);
  const result = evaluateRules(amount, rules);

  try {
    // Insert final loyalty transaction in a transaction for safety
    const conn = await vaultDb.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO collecto_vault_transaction (transaction_id, business_id, phone_number, amount, points, rules_applied)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transactionId, businessId, phone, amount, result.points, JSON.stringify(result.applied)]
      );

      await conn.query(
        `INSERT INTO points_balance (business_id, phone_number, total_points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE total_points = total_points + VALUES(total_points), updated_at = NOW()`,
        [businessId, phone, result.points]
      );

      await conn.commit();
      console.log(`[vaultWorker] Processed tx ${transactionId}: +${result.points} points`);
    } catch (err) {
      await conn.rollback();
      // If duplicate unique key error, it's ok (idempotent)
      console.error('[vaultWorker] DB insert failed', err);
      throw err;
    } finally {
      conn.release();
    }

    // Send SMS (non-blocking)
    const message = `You earned ${result.points} points for your purchase. Transaction: ${transactionId}`;
    await sendSms(businessId, phone, message);

  } catch (err) {
    console.error('[worker] processing error', err);
    throw err;
  }
}

async function processBusiness(businessId: number) {
  let afterId = await getCheckpoint(businessId);
  while (true) {
    const txs = await fetchCollectoTransactions(businessId, afterId, PAGE_LIMIT);
    if (!txs.length) break;
    for (const tx of txs) {
      try {
        await processCollectoTx(tx);
      } catch (err) {
        console.error('error processing tx', tx.transaction_id, err);
        // Do not update checkpoint for this tx; stop and retry later
        return;
      }
      afterId = Number(tx.id);
    }
    // update checkpoint after processing batch
    await setCheckpoint(businessId, afterId);
    if (txs.length < PAGE_LIMIT) break; // done for now
  }
}

async function loop() {
  while (true) {
    try {
      const businesses = await getLoyalBusinesses();
      for (const b of businesses) {
        try {
          await processBusiness(b.id);
        } catch (err) {
          console.error('error processing business', b.id, err);
        }
      }
    } catch (err) {
      console.error('worker top-level error', err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop().catch((e) => console.error('worker crashed', e));
