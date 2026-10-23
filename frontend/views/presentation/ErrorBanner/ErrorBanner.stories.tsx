import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorBanner } from "./index";

const meta = {
  title: "Presentation/ErrorBanner",
  component: ErrorBanner,
  parameters: { layout: "padded" },
  args: {
    message: "Couldn't load payments. Please try again.",
  },
} satisfies Meta<typeof ErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

// With a retry affordance (shown when `onRetry` is provided).
export const WithRetry: Story = { args: { onRetry: () => {} } };

// Message only — no retry button.
export const WithoutRetry: Story = {};
