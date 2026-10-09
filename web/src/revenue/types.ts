export type Platform = "apple" | "google";
export type Basis = "estimate" | "settled";
export type TaxClass =
  "unreviewed" | "taxable" | "zero" | "exempt" | "excluded";
export interface AppGroup {
  id: string;
  name: string;
  appleAppIds: string[];
  googlePackages: string[];
}
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
  source?: "apple-sales" | "apple-finance" | "google-sales" | "google-earnings" | "standard";
  reportScope?: string;
  periodKind?: "calendar" | "fiscal";
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
  /** Explicit Google Orders API provenance, never an assumed commission. */
  proceedsSource?: "google-orders";
  proceedsFetchedAt?: string;
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
  period?: string;
  source?: "api" | "cache";
  fetchedAt?: string;
  sourceUpdatedAt?: string;
  rows: number;
}
export interface SyncLog {
  id: string;
  at: string;
  status: "success" | "partial" | "error";
  message: string;
  detail?: {
    completed?: string[];
    errors?: string[];
    apps?: number;
    documents?: number;
    appleMonths?: number;
    googleMonths?: number;
  };
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
  rates: Record<string, { value: number; note: string; source?: "manual" | "frankfurter" | "ecb"; observedAt?: string; asOf?: string }>;
  goal: number;
  business: {
    name: string;
    number: string;
    kind: "general" | "simplified";
    prepaid: Record<string, number>;
  };
  checklist: Record<string, boolean>;
  appGroups?: AppGroup[];
  meta?: {
    lastCloudAt?: string;
    updatedAt?: string;
    dismissedAlerts?: string[];
    googleSaEmail?: string;
  };
}
export interface GoogleOrderProceeds {
  /** Zero-based index into the original CSV data rows (excluding its header). */
  rowIndex: number;
  proceeds: number;
  currency: string;
  fetchedAt: string;
}
export interface StoreDocument {
  googleOrderProceeds?: GoogleOrderProceeds[];
  source?: "api" | "cache";
  fetchedAt?: string;
  sourceUpdatedAt?: string;
  periodKind?: "calendar" | "fiscal";
  key: string;
  name: string;
  text: string;
  period: string;
}
export interface ConnectorStatus {
  apiVersion?: number;
  apple: { configured: boolean; reports: boolean; missing: string[] };
  google: { configured: boolean; reports: boolean; missing: string[] };
  connector?: { online: boolean; uptimeMs: number; port: number; apiVersion?: number; syncScopes?: string[]; currentMonth?: string };
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
