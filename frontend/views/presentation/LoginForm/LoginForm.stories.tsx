import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
    onSubmit: fn(),
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

// Interaction: submitting an empty form surfaces validation errors and does not
// call onSubmit.
export const ValidationErrors: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));
    await expect(canvas.getByText("Email is required.")).toBeInTheDocument();
    await expect(canvas.getByText("Password is required.")).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

// Interaction: valid credentials submit the form with the typed values.
export const SubmitsCredentials: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Email"), "cs@test.com");
    await userEvent.type(canvas.getByLabelText("Password"), "password");
    await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: "cs@test.com",
      password: "password",
    });
  },
};
