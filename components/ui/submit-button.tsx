"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
};

export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button aria-disabled={pending} className={className} disabled={pending} type="submit">
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" size={18} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
