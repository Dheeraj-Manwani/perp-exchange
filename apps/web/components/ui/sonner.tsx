"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-elevated)",
          border: "1px solid var(--color-line)",
          borderLeft: "3px solid var(--color-yellow)",
          color: "var(--color-t1)",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
