import { Form } from "@remix-run/react";
import type { ReactNode } from "react";

export function CampaignFilterRow({
  children,
  method = "get",
}: {
  children: ReactNode;
  method?: "get" | "post";
}) {
  return (
    <Form
      method={method}
      replace={method === "get"}
      className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {children}
      </div>
    </Form>
  );
}
