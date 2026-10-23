import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar } from "./index";

const meta = {
  title: "Presentation/Sidebar",
  component: Sidebar,
  // `hidden lg:flex` — only visible on a wide, full-height canvas.
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Static navigation chrome; "Payments" is the only wired destination.
export const Default: Story = {
  render: () => (
    <div className="flex h-screen">
      <Sidebar />
    </div>
  ),
};
