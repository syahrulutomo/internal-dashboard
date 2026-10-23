import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaymentsHero } from "./index";
import { sampleSummary } from "@/views/_stories/fixtures";

const meta = {
  title: "Presentation/PaymentsHero",
  component: PaymentsHero,
  parameters: { layout: "padded" },
  args: {
    summary: sampleSummary,
    loading: false,
  },
} satisfies Meta<typeof PaymentsHero>;

export default meta;
type Story = StoryObj<typeof meta>;

// Total payments + volume on the left, a status breakdown bar and success rate
// on the right.
export const Default: Story = {};

// Pulsing placeholder shown while the summary query is in flight.
export const Loading: Story = { args: { loading: true, summary: null } };
