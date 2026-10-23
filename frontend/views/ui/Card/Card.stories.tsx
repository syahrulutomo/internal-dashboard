import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./index";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// The base surface container — rounded, bordered, subtle shadow. Content sets
// its own padding.
export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <div className="p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Total payments
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          A reusable surface for grouping related content such as stat cards,
          tables and panels.
        </p>
      </div>
    </Card>
  ),
};
