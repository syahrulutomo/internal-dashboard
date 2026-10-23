import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./index";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["success", "warning", "danger", "neutral"],
    },
  },
  args: {
    tone: "neutral",
    children: "Badge",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Positive / confirmed state.
export const Success: Story = { args: { tone: "success", children: "Completed" } };

// In-progress / needs-attention state.
export const Warning: Story = { args: { tone: "warning", children: "Processing" } };

// Error / failed state.
export const Danger: Story = { args: { tone: "danger", children: "Failed" } };

// Default, low-emphasis label.
export const Neutral: Story = { args: { tone: "neutral", children: "Draft" } };

// All tones side by side.
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge tone="success">Completed</Badge>
      <Badge tone="warning">Processing</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="neutral">Draft</Badge>
    </div>
  ),
};
