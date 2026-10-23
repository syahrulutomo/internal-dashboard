import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./index";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered" },
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

// A single line placeholder — size is driven entirely by className.
export const Default: Story = {};

// Avatar / icon placeholder.
export const Circle: Story = { args: { className: "size-12 rounded-full" } };

// A composed loading state, e.g. a stat card placeholder.
export const CardBlock: Story = {
  render: () => (
    <div className="w-72 rounded-2xl border border-[var(--border)] bg-white p-6">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="mt-5 h-9 w-16" />
      <Skeleton className="mt-4 h-4 w-32" />
    </div>
  ),
};
