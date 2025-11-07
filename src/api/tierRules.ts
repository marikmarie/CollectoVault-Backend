// src/api/tierRules.ts
import { IncomingMessage, ServerResponse } from 'http';
import vaultDb from '../db/db_vault';
import { readJSON } from './_utils';

export async function handleCreateTierRule(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJSON(req);

    const business_id = Number(body.business_id);
    const name = String(body.name);
    const min_points = Number(body.min_points);
    const benefits = body.benefits ?? {};

    const [result] = await vaultDb.query(
      `INSERT INTO collecto_vault_tier_rule (business_id, name, min_points, benefits)
       VALUES (?, ?, ?, ?)`,
      [business_id, name, min_points, JSON.stringify(benefits)]
    );

    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, insertId: (result as any).insertId }));

  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

export async function handleListTierRules(req: IncomingMessage, res: ServerResponse) {
  try {
    const [rows] = await vaultDb.query(
      `SELECT id, business_id, name, min_points, benefits, created_at
       FROM collecto_vault_tier_rule
       ORDER BY created_at DESC`
    );

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(rows));

  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}
