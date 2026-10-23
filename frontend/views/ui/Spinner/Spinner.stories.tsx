import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./index";

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default size; inherits the current text color.
export const Default: Story = {};

// Larger, brand-tinted spinner (e.g. a full-page loading state).
export const Large: Story = { args: { className: "size-8 text-brand-600" } };

// On a dark surface — the spinner uses `currentColor`, so white text shows it.
export const OnBrand: Story = {
  render: () => (
    <div className="rounded-xl bg-brand-900 p-6 text-white">
      <Spinner className="size-6" />
    </div>
  ),
};
