import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecentPayments } from "./index";
import {
  sampleMeta,
  samplePayments,
  sampleSummary,
} from "@/views/_stories/fixtures";

const meta = {
  title: "Presentation/RecentPayments",
  component: RecentPayments,
  parameters: { layout: "padded" },
  args: {
    payments: samplePayments,
    meta: sampleMeta,
    summary: sampleSummary,
    status: "all",
    search: "",
    onPageChange: () => {},
    onStatusChange: () => {},
    onSearchChange: () => {},
  },
} satisfies Meta<typeof RecentPayments>;

export default meta;
type Story = StoryObj<typeof meta>;

// A page of payments with status tabs (counts from the summary), search and
// pagination.
export const Loaded: Story = {};

// Skeleton rows while the first page loads.
export const Loading: Story = { args: { loading: true, payments: [] } };

// Active search with no matches — the empty state explains why.
export const EmptySearch: Story = {
  args: {
    payments: [],
    search: "zzzzz",
    meta: { ...sampleMeta, total: 0, total_pages: 0 },
  },
};
