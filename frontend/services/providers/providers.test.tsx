import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "./index";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// A child that depends on all three contexts Providers must supply. If any
// provider is missing, these hooks throw and the render fails.
function Consumer() {
  const { isAuthenticated } = useAuth();
  const { toasts } = useToast();
  return (
    <div data-testid="consumer">
      {String(isAuthenticated)}-{toasts.length}
    </div>
  );
}

describe("Providers", () => {
  it("renders children with query, auth and toast contexts available", () => {
    render(
      <Providers>
        <Consumer />
      </Providers>,
    );
    const consumer = screen.getByTestId("consumer");
    expect(consumer).toBeInTheDocument();
    expect(consumer).toHaveTextContent("false-0");
  });
});
