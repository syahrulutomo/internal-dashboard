import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginHero } from "./index";

const meta = {
  title: "Presentation/LoginHero",
  component: LoginHero,
  // Branded panel is `hidden lg:flex` and fills its column, so show it
  // full-bleed on a tall canvas.
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LoginHero>;

export default meta;
type Story = StoryObj<typeof meta>;

// The decorative left panel of the login screen (brand mark + tagline).
export const Default: Story = {
  render: () => (
    <div className="h-screen p-5">
      <LoginHero />
    </div>
  ),
};
