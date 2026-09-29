export type Platform = "apple" | "google";
export type Basis = "estimate" | "settled";
export type TaxClass =
  "unreviewed" | "taxable" | "zero" | "exempt" | "excluded";
export interface AppProduct {
  id: string;
  name: string;
  platform: Platform;
  bundleId: string;
  version: string;
  build: string;
  status: string;
  updatedAt: string;
  source: "manual" | "api" | "demo";
  favorite?: boolean;
}
export interface RevenueRow {
  id: string;
  reportKey: string;
  date: string;
  endDate?: string;
  period: string;
  appId: string;
  appName: string;
  platform: Platform;
  country: string;
  currency: string;
  proceedsCurrency: string;
  gross: number;
  refunds: number;
  fee: number | null;
  tax: number | null;
  proceeds: number | null;
  units: number;
  basis: Basis;
  // Store deductions are not the business's Korean output VAT.
  taxClass: TaxClass;
  supplyAmount?: number;
  outputVat?: number;
  evidence?: string;
  taxDate?: string;
}
export interface Expense {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
  inputVat: number;
  deductible: boolean;
  evidence: string;
}
export interface Payout {
  id: string;
  platform: Platform;
  month: string;
  dueDate: string;
  expected: number;
  received: number;
  receivedDate: string;
  memo: string;
}
export interface ImportRecord {
  key: string;
  name: string;
  importedAt: string;
  rows: number;
}
export interface SyncLog {
  id: string;
  at: string;
  status: "success" | "partial" | "error";
  message: string;
}
export interface RevenueData {
  schema: 1;
  apps: AppProduct[];
  rows: RevenueRow[];
  expenses: Expense[];
  payouts: Payout[];
  imports: ImportRecord[];
  logs: SyncLog[];
  // Rate is KRW per one foreign unit, keyed by YYYY-MM:currency.
  rates: Record<string, { value: number; note: string }>;
  goal: number;
  business: {
    name: string;
    number: string;
    kind: "general" | "simplified";
    prepaid: Record<string, number>;
  };
  checklist: Record<string, boolean>;
}
export interface StoreDocument {
  key: string;
  name: string;
  text: string;
  period: string;
}
export interface ConnectorStatus {
  apple: { configured: boolean; reports: boolean; missing: string[] };
  google: { configured: boolean; reports: boolean; missing: string[] };
  connector?: { online: boolean; uptimeMs: number; port: number };
}
export interface SyncResult {
  id: string;
  state: "running" | "done";
  progress: string;
  apps: AppProduct[];
  documents: StoreDocument[];
  errors: string[];
  completed: string[];
}
