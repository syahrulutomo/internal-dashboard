import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toaster } from "./index";
import { ToastProvider, useToast, type ToastVariant } from "@/hooks/use-toast";
import { Button } from "@/views/ui/Button";

// The Toaster renders the live toast stack and returns null when empty, so it is
// exercised through a small demo that fires toasts via the useToast() context.
function ToasterDemo() {
  const { toast } = useToast();

  // Fire one on mount so the docs preview isn't empty.
  useEffect(() => {
    toast({
      variant: "success",
      title: "Export ready",
      description: "Your CSV has been downloaded.",
    });
  }, [toast]);

  const fire = (variant: ToastVariant) =>
    toast({
      variant,
      title:
        variant === "error"
          ? "Couldn't load payments"
          : variant === "success"
            ? "Saved"
            : "Heads up",
      description: `This is a ${variant} toast.`,
    });

  return (
    <div className="flex gap-3 p-6">
      <Button variant="secondary" size="sm" onClick={() => fire("error")}>
        Error
      </Button>
      <Button variant="secondary" size="sm" onClick={() => fire("success")}>
        Success
      </Button>
      <Button variant="secondary" size="sm" onClick={() => fire("info")}>
        Info
      </Button>
      <Toaster />
    </div>
  );
}

const meta = {
  title: "Presentation/Toaster",
  component: Toaster,
  // The stack is fixed to the top-right of the viewport.
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

// Use the buttons to fire each toast variant; one success toast fires on load.
export const Default: Story = {
  render: () => (
    <ToastProvider>
      <ToasterDemo />
    </ToastProvider>
  ),
};
