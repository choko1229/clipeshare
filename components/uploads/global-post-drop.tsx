"use client";

import { useEffect } from "react";
import { savePendingPostFile, selectPostFile } from "@/components/uploads/pending-post-file";

export function GlobalPostDrop() {
  useEffect(() => {
    function shouldIgnoreDrop(event: DragEvent) {
      const target = event.target;
      if (window.location.pathname.startsWith("/admin")) {
        return true;
      }
      if (!(target instanceof Element)) {
        return false;
      }
      return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
    }

    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes("Files");
    }

    function handleDragOver(event: DragEvent) {
      if (shouldIgnoreDrop(event) || !hasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    }

    async function handleDrop(event: DragEvent) {
      if (shouldIgnoreDrop(event) || !event.dataTransfer?.files.length) {
        return;
      }

      event.preventDefault();
      const file = selectPostFile(Array.from(event.dataTransfer.files));
      if (!file) {
        return;
      }

      await savePendingPostFile(file);

      if (window.location.pathname === "/posts/new") {
        window.dispatchEvent(new Event("clipeshare:pending-post-file"));
        return;
      }

      window.location.assign("/posts/new?fromDrop=1");
    }

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  return null;
}
