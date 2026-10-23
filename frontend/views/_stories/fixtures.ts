// Sample data for Storybook stories, shaped to the real domain types so the
// documented components render exactly as they do in the app.

import type {
  AuthUser,
  PaginationMeta,
  Payment,
  PaymentsSummary,
} from "@/libs/types";

export const samplePayments: Payment[] = [
  {
    id: "PAY-1042",
    merchant: "Batik Arunika",
    status: "completed",
    amount: "1982000.00",
    created_at: "2026-01-18T09:24:00Z",
  },
  {
    id: "PAY-1041",
    merchant: "Kopi Senja",
    status: "processing",
    amount: "345500.00",
    created_at: "2026-01-18T07:10:00Z",
  },
  {
    id: "PAY-1040",
    merchant: "Nusantara Textiles",
    status: "failed",
    amount: "52750.00",
    created_at: "2026-01-17T22:02:00Z",
  },
  {
    id: "PAY-1039",
    merchant: "Garuda Logistics",
    status: "completed",
    amount: "8740000.00",
    created_at: "2026-01-17T16:48:00Z",
  },
  {
    id: "PAY-1038",
    merchant: "Warung Maju Jaya",
    status: "completed",
    amount: "127300.00",
    created_at: "2026-01-17T11:30:00Z",
  },
];

export const sampleMeta: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 48,
  total_pages: 5,
};

// Matches the seeded dataset distribution (48 total: 30/11/7).
export const sampleSummary: PaymentsSummary = {
  total: 48,
  completed: 30,
  processing: 11,
  failed: 7,
  totalAmount: 284500000,
  amountByStatus: {
    completed: 231800000,
    processing: 41200000,
    failed: 11500000,
  },
};

export const sampleUser: AuthUser = {
  email: "rina.wijaya@durianpay.id",
  role: "operation",
  token: "sample.jwt.token",
};
