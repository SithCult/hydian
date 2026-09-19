import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    position="top-center"
    duration={4000}
    gap={8}
    offset={{ top: 60 }}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          "flex w-[360px] items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-[13px] text-strong shadow-[0_8px_24px_rgba(0,0,0,0.45)] border-l-[3px] border-l-primary",
        success: "border-l-ok",
        warning: "border-l-destructive",
        error: "border-l-destructive",
        title: "font-medium",
        description: "text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
