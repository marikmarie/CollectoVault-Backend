// src/api/pointRules.ts
import { IncomingMessage, ServerResponse } from 'http';
import vaultDb from '../db_vault';
import { readJSON } from './_utils';

export async function handleCreatePointRule(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJSON(req);

    const business_id = Number(body.business_id);
    const name = String(body.name);
    const type = String(body.type);
    const params = body.params ?? {};
    const priority = body.priority ?? 100;

    const [result] = await vaultDb.query(
      `INSERT INTO collecto_vault_pointrule (business_id, name, type, params, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [business_id, name, type, JSON.stringify(params), priority]
    );

    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, insertId: (result as any).insertId }));

  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

export async function handleListPointRules(req: IncomingMessage, res: ServerResponse) {
  try {
    const [rows] = await vaultDb.query(
      `SELECT id, business_id, name, type, params, priority, created_at
       FROM collecto_vault_pointrule
       ORDER BY created_at DESC`
    );

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(rows));

  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}
