
import vaultDb from './db_vault';

export async function sendSms(businessId: number | null, phone: string, message: string) {
  const [res] = await vaultDb.query(
    `INSERT INTO collecto_vault_sms_log (business_id, phone_number, message, status) VALUES (?, ?, ?, ?)`,
    [businessId, phone, message, 'queued']
  );
  const insertId = (res as any).insertId;
  // Pretend to send for now
  await vaultDb.query(`UPDATE collecto_vault_sms_log SET status = 'sent' WHERE id = ?`, [insertId]);
  return { ok: true, id: insertId };
}
