import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginForm } from "./index";

const meta = {
  title: "Presentation/LoginForm",
  component: LoginForm,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  args: {
    onSubmit: () => {},
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// Idle form with client-side validation (fields validate on submit).
export const Default: Story = {};

// Submit in flight — button shows the loading state.
export const Loading: Story = { args: { loading: true } };

// Locked out after the API rate-limited login (HTTP 429); the submit button
// shows the cooldown countdown instead of "Sign in".
export const CooldownDisabled: Story = {
  args: { disabled: true, cooldownLabel: "Try again in 4:58" },
};
