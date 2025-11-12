"use strict";
// import vaultDb from '../db/db_vault';
// import { PointRuleRow } from '../types';
Object.defineProperty(exports, "__esModule", { value: true });
// export async function loadPointRulesForBusiness(businessId: number): Promise<PointRuleRow[]> {
//   const [rows] = await vaultDb.query('SELECT * FROM collecto_vault_pointrule WHERE business_id = ? ORDER BY priority ASC', [businessId]);
//   return (rows as any[]) as PointRuleRow[];
// }
// export function evaluateRules(amount: number, rules: PointRuleRow[]) {
//   let totalPoints = 0;
//   const applied: any[] = [];
//   for (const r of rules) {
//     const params = typeof r.params === 'string' ? JSON.parse(r.params) : r.params;
//     let pts = 0;
//     if (r.type === 'per_amount') {
//       const per = Number(params.per ?? 100);
//       const pointsPer = Number(params.points ?? 1);
//       pts = Math.floor(amount / per) * pointsPer;
//     } else if (r.type === 'fixed') {
//       pts = Number(params.points ?? 0);
//     } else if (r.type === 'multiplier') {
//       const mult = Number(params.multiplier ?? 1);
//       pts = Math.floor(totalPoints * (mult - 1));
//     } else if (r.type === 'campaign') {
//       const now = new Date();
//       const start = params.start ? new Date(params.start) : null;
//       const end = params.end ? new Date(params.end) : null;
//       if ((!start || now >= start) && (!end || now <= end)) {
//         pts = Number(params.extra_points ?? 0);
//       }
//     }
//     if (pts > 0) {
//       applied.push({ id: r.id, name: r.name, type: r.type, points: pts });
//       totalPoints += pts;
//     }
//   }
//   return { points: totalPoints, applied };
// }
