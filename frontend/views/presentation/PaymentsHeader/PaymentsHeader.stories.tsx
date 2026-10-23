import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaymentsHeader } from "./index";

const meta = {
  title: "Presentation/PaymentsHeader",
  component: PaymentsHeader,
  parameters: { layout: "padded" },
  args: {
    updatedLabel: "2 min ago",
    onRefresh: () => {},
    onExport: () => {},
  },
} satisfies Meta<typeof PaymentsHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// Operation role: the Export CSV CTA is shown (RBAC — `canExport` true).
export const OperationRole: Story = { args: { canExport: true } };

// CS role: export is restricted, so the CTA is hidden entirely (`canExport`
// false, the default). Export is enforced server-side regardless of the UI.
export const CsRole: Story = { args: { canExport: false } };

// Refresh in flight — the Refresh button shows its loading state.
export const Refreshing: Story = { args: { canExport: true, refreshing: true } };
