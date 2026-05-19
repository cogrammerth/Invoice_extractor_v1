/** Payment details (task 9) — discriminated by method. */
export type PaymentDetails =
  | { method: 'เงินสด'; amount: string }
  | { method: 'บัตรเครดิต'; amount: string }
  | { method: 'เงินโอน'; transfer_details: string; amount: string }
  | {
      method: 'เช็ค';
      cheque_number: string;
      cheque_date: string;
      amount: string;
    };

export interface PagesMarker {
  value: string;
  is_last_page: boolean;
}

export interface DocumentGroup {
  document_number: string;
  pages: number[];
}

/** 14-field Thai invoice extraction payload. */
export interface ThaiInvoiceExtraction {
  corner_no: string;
  e_tax_flag: 'E-TAX' | 'Non E-TAX';
  invoice_number: string;
  cust_code: string;
  pages: PagesMarker;
  currency: string;
  payment_method: string;
  net_total: string | null;
  delivery_instructions: string;
  payment_details: PaymentDetails | null;
  item_descriptions: string[];
  received_by: 'Yes' | 'No';
  delivery_by: 'Yes' | 'No';
  stamp: 'Stamp present' | 'No stamp';
  document_groups: DocumentGroup[];
}

export interface ExtractionRow {
  id: string;
  userId: string;
  requestId: string | null;
  invoiceNumber: string;
  custCode: string;
  extractionData: ThaiInvoiceExtraction;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  durationMs: number;
  slow: boolean;
  modelName: string;
  sourceMimeType: string;
  sourceOriginalFilename: string;
  sourceFileSizeBytes: number;
  filePath: string | null;
  createdAt: string;
}

export interface TokensUsed {
  input: number;
  output: number;
  total: number;
}

export interface TokenUsageSummary {
  extractionCount: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  estimatedCostUsd: number;
  periodDays: number;
}

export interface TokenUsagePricing {
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
  modelName: string;
  note: string;
}

export interface TokenUsageData {
  summary: TokenUsageSummary;
  pricing: TokenUsagePricing;
}

export interface UploadSuccessData {
  extractionId: string;
  data: ThaiInvoiceExtraction;
  tokensUsed: TokensUsed;
  durationMs: number;
  slow: boolean;
}
