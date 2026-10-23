import type { Meta, StoryObj } from "@storybook/react-vite";
import { Topbar } from "./index";
import { sampleUser } from "@/views/_stories/fixtures";

const meta = {
  title: "Presentation/Topbar",
  component: Topbar,
  parameters: { layout: "padded" },
  args: {
    user: sampleUser,
    onLogout: () => {},
  },
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Operation user — the display name is derived from the email local-part
// ("rina.wijaya@durianpay.id" → "Rina Wijaya").
export const Default: Story = {};

// A CS user, showing a different derived name and role label.
export const CsUser: Story = {
  args: {
    user: { ...sampleUser, email: "cs@test.com", role: "cs" },
  },
};
