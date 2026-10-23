import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./index";
import { ArrowRightIcon, DownloadIcon } from "@/views/ui/Icons";

const meta = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost"],
    },
    size: { control: "inline-radio", options: ["sm", "md"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    onClick: { action: "clicked" },
  },
  args: {
    children: "Sign in",
    variant: "primary",
    size: "md",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary", children: "Refresh" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };

export const Small: Story = { args: { size: "sm", children: "Export CSV" } };

export const Loading: Story = { args: { loading: true, children: "Signing in…" } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <DownloadIcon className="size-4" />
        Export CSV
      </>
    ),
  },
};

// All variants and sizes side by side.
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["primary", "secondary", "ghost"] as const).map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <Button variant={variant} size="sm">
            {variant} sm
          </Button>
          <Button variant={variant} size="md">
            {variant} md
          </Button>
          <Button variant={variant} loading>
            loading
          </Button>
          <Button variant={variant} disabled>
            disabled
          </Button>
        </div>
      ))}
      <Button>
        Continue
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  ),
};
