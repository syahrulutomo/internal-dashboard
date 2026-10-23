import type { Meta, StoryObj } from "@storybook/react-vite";
import { DashboardShell } from "./index";
import { sampleUser } from "@/views/_stories/fixtures";

const meta = {
  title: "Presentation/DashboardShell",
  component: DashboardShell,
  // The sidebar is `hidden lg:flex`, so the shell only shows its full frame on a
  // wide canvas.
  parameters: { layout: "fullscreen" },
  args: {
    user: sampleUser,
    onLogout: () => {},
    children: (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
        <p className="mt-1 text-[var(--muted)]">
          Dashboard content goes here.
        </p>
      </div>
    ),
  },
} satisfies Meta<typeof DashboardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sidebar + topbar frame wrapping the scrollable content area.
export const Default: Story = {};
