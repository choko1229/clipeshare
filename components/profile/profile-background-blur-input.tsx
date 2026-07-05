"use client";

import { useState } from "react";

type ProfileBackgroundBlurInputProps = {
  defaultValue: number;
};

export function ProfileBackgroundBlurInput({ defaultValue }: ProfileBackgroundBlurInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block text-sm font-medium" htmlFor="profileBackgroundBlur">
      <span className="flex items-center justify-between gap-3">
        背景ぼかし量
        <span className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">{value}px</span>
      </span>
      <input
        className="mt-2 w-full accent-primary"
        defaultValue={defaultValue}
        id="profileBackgroundBlur"
        max={128}
        min={0}
        name="profileBackgroundBlur"
        onChange={(event) => setValue(Number(event.currentTarget.value))}
        step={1}
        type="range"
      />
    </label>
  );
}
