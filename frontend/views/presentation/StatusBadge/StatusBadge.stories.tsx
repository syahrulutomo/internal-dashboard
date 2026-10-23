import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./index";

const meta = {
  title: "Presentation/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["completed", "processing", "failed"],
    },
  },
  args: { status: "completed" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Settled payment.
export const Completed: Story = { args: { status: "completed" } };

// In-flight payment.
export const Processing: Story = { args: { status: "processing" } };

// Failed payment.
export const Failed: Story = { args: { status: "failed" } };

// All three statuses side by side.
export const Gallery: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <StatusBadge status="completed" />
      <StatusBadge status="processing" />
      <StatusBadge status="failed" />
    </div>
  ),
};
