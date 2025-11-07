export type PointRuleType = 'per_amount' | 'fixed' | 'multiplier' | 'campaign';

export interface PointRuleRow {
  id: number;
  business_id: number;
  name: string;
  type: string;
  params: any;
  priority: number;
}
