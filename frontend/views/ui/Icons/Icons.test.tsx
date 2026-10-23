import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as Icons from "./index";

// Every exported icon is a stroke-based inline SVG. Rather than asserting paths,
// verify each renders a well-formed, accessibility-hidden svg and forwards props.
const iconNames = Object.keys(Icons) as (keyof typeof Icons)[];

describe("Icons", () => {
  it("exports a non-empty icon set", () => {
    expect(iconNames.length).toBeGreaterThan(0);
  });

  it.each(iconNames)("%s renders an aria-hidden svg", (name) => {
    const Icon = Icons[name];
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards className to the underlying svg", () => {
    const { container } = render(
      <Icons.PulseIcon className="custom-icon-class" />,
    );
    expect(container.querySelector("svg")!.getAttribute("class")).toContain(
      "custom-icon-class",
    );
  });
});
