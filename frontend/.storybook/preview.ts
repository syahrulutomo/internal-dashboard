import type { Preview } from "@storybook/react-vite";
// Brings in Tailwind + the design tokens (@theme brand scale and the :root CSS
// variables like --surface/--border/--muted) the components rely on.
import "../app/globals.css";

const preview: Preview = {
  // Generate a documentation page for every component from its stories + props.
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The app canvas sits on the muted green-grey background; several components
    // (cards, badges) are designed against it, while the dark ones (Sidebar,
    // LoginHero, PaymentsHero) bring their own brand-900 surface.
    backgrounds: {
      options: {
        app: { name: "App", value: "#f2f3f0" },
        surface: { name: "Surface", value: "#ffffff" },
        brand: { name: "Brand 900", value: "#054f31" },
      },
    },
    initialGlobals: {
      backgrounds: { value: "app" },
    },
  },
};

export default preview;
