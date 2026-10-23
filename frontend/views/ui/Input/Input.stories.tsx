import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./index";
import { EyeIcon, MailIcon } from "@/views/ui/Icons";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  // Give every story a sensible width to render against.
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    id: "field",
    label: "Email",
    placeholder: "you@company.id",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// Label + placeholder, the baseline field.
export const Default: Story = {};

// A decorative icon rendered inside the field on the left.
export const WithLeadingIcon: Story = {
  args: { leadingIcon: <MailIcon className="size-5" /> },
};

// A trailing affordance (e.g. a password visibility toggle).
export const WithTrailing: Story = {
  args: {
    label: "Password",
    type: "password",
    placeholder: "Enter your password",
    trailing: <EyeIcon className="size-5" />,
  },
};

// Invalid state: red ring + an error message wired to the field via aria.
export const WithError: Story = {
  args: { error: "Enter a valid email address.", defaultValue: "not-an-email" },
};

// Non-editable state.
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "you@company.id" },
};
