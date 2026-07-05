"use client";

import { useState } from "react";

type ProfileOpacityInputProps = {
  defaultValue: number;
};

export function ProfileOpacityInput({ defaultValue }: ProfileOpacityInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block text-sm font-medium" htmlFor="profileOverlayOpacity">
      <span className="flex items-center justify-between gap-3">
        オーバーレイ透明度
        <span className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">{value}%</span>
      </span>
      <input
        className="mt-2 w-full accent-primary"
        defaultValue={defaultValue}
        id="profileOverlayOpacity"
        max={100}
        min={0}
        name="profileOverlayOpacity"
        onChange={(event) => setValue(Number(event.currentTarget.value))}
        step={1}
        type="range"
      />
    </label>
  );
}
