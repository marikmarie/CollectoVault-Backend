// src/api/business.ts
import { IncomingMessage, ServerResponse } from 'http';
import vaultDb from '../db/db_vault';
import { readJSON } from './_utils';

export async function handleEnableLoyalty(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJSON(req);
    const business_id = Number(body.business_id);

    
    await vaultDb.query(
      `UPDATE collecto_vault_business SET loyalty_enabled = 1 WHERE id = ?`,
      [business_id]
    );

    
    await vaultDb.query(
      `INSERT INTO collecto_vault_poll_checkpoint (business_id, last_processed_collecto_tx_id)
       VALUES (?, 0)
       ON DUPLICATE KEY UPDATE business_id = business_id`,
      [business_id]
    );

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}
