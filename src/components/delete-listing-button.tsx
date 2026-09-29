"use client";

import { Trash2 } from "lucide-react";

export function DeleteListingButton({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this listing? This action cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
      >
        <Trash2 size={16} />
        Delete
      </button>
    </form>
  );
}
