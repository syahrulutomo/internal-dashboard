// Shared domain types mirroring the backend OpenAPI contract.

export type PaymentStatus = "completed" | "processing" | "failed";

// The roles the backend issues in the JWT `role` claim. Use these constants
// instead of the bare strings so role checks stay consistent across the app.
export const ROLES = {
  CS: "cs",
  OPERATION: "operation",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export interface Payment {
  id: string;
  merchant: string;
  status: PaymentStatus;
  amount: string; // decimal string, e.g. "1982.00"
  created_at: string; // RFC3339 timestamp
}

// Pagination metadata returned alongside a page of payments. Field names are
// snake_case to match the wire format from the API (see openapi.yaml).
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaymentListResponse {
  payments: Payment[];
  // Optional because the OpenAPI response schema does not mark `meta` as
  // required; the backend always sets it, but the UI guards for its absence.
  meta?: PaginationMeta;
}

export interface AuthUser {
  email: string;
  role: UserRole;
  token: string;
}

// Wire shape of GET /dashboard/v1/auth/me — the caller's identity derived from
// the verified token (no token echoed back). The frontend treats this as the
// authoritative source of the user's role for RBAC decisions.
export interface UserInfo {
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Wire shape of GET /dashboard/v1/payments/summary. snake_case mirrors the API
// (see openapi.yaml); amounts are decimal strings like `Payment.amount`. The
// service layer maps this into the UI-facing `PaymentsSummary` below.
export interface SummaryResponse {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  total_amount: string;
  amount_by_status: Record<PaymentStatus, string>;
}

export interface PaymentsSummary {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  totalAmount: number;
  // Settled / pending / not-collected volume, keyed by status.
  amountByStatus: Record<PaymentStatus, number>;
}

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "completed",
  "processing",
  "failed",
];
