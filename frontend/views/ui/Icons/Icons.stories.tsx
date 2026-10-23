import type { Meta, StoryObj } from "@storybook/react-vite";
import * as Icons from "./index";

// The inline icon set has no single component, so the meta carries no
// `component` — the one story below renders the whole set as a reference gallery.
const meta = {
  title: "UI/Icons",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Every exported icon with its name. Icons inherit `currentColor` and size via
// className (here `size-6`).
export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 text-gray-700 sm:grid-cols-3 md:grid-cols-4">
      {Object.entries(Icons).map(([name, Icon]) => (
        <div
          key={name}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3"
        >
          <Icon className="size-6 shrink-0 text-brand-600" />
          <span className="truncate font-mono text-xs text-gray-500">
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
};
