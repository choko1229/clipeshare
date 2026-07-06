"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type DeletePostButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  publicId: string;
  title: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit" variant="destructive">
      {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Trash2 size={18} />}
      {pending ? "削除中" : "投稿を削除"}
    </Button>
  );
}

export function DeletePostButton({ action, publicId, title }: DeletePostButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(`「${title}」を削除します。この操作後、投稿は公開画面から表示されなくなります。`);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="publicId" type="hidden" value={publicId} />
      <SubmitButton />
    </form>
  );
}
