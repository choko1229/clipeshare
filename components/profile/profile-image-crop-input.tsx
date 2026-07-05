"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

type ProfileImageCropInputProps = {
  accept?: string;
  aspectRatio: number;
  defaultPreviewUrl?: string | null;
  description: string;
  label: string;
  name: string;
  outputHeight: number;
  outputWidth: number;
};

type SourceImage = {
  height: number;
  url: string;
  width: number;
};

const defaultAccept = "image/jpeg,image/png,image/webp";

export function ProfileImageCropInput({
  accept = defaultAccept,
  aspectRatio,
  defaultPreviewUrl,
  description,
  label,
  name,
  outputHeight,
  outputWidth,
}: ProfileImageCropInputProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const sourceObjectUrlRef = useRef<string | null>(null);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultPreviewUrl ?? null);
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    return () => {
      if (sourceObjectUrlRef.current) {
        URL.revokeObjectURL(sourceObjectUrlRef.current);
      }
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  async function loadSelectedFile(file: File | null) {
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    const dimensions = await readImageDimensions(url);
    if (!dimensions) {
      URL.revokeObjectURL(url);
      return;
    }

    if (sourceObjectUrlRef.current) {
      URL.revokeObjectURL(sourceObjectUrlRef.current);
    }
    sourceObjectUrlRef.current = url;

    setSourceImage({
      height: dimensions.height,
      url,
      width: dimensions.width,
    });
    setOffsetX(50);
    setOffsetY(50);
    setZoom(1);
    await applyCrop({
      height: dimensions.height,
      url,
      width: dimensions.width,
    }, 1, 50, 50);
  }

  async function applyCrop(image: SourceImage | null = sourceImage, nextZoom = zoom, nextOffsetX = offsetX, nextOffsetY = offsetY) {
    if (!image || !hiddenInputRef.current) {
      return;
    }

    const croppedBlob = await cropImageToBlob({
      aspectRatio,
      image,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
      outputHeight,
      outputWidth,
      zoom: nextZoom,
    });

    if (!croppedBlob) {
      return;
    }

    const file = new File([croppedBlob], `${name}.webp`, {
      lastModified: Date.now(),
      type: "image/webp",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    hiddenInputRef.current.files = transfer.files;

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  function updateZoom(value: number) {
    setZoom(value);
    void applyCrop(sourceImage, value, offsetX, offsetY);
  }

  function updateOffsetX(value: number) {
    setOffsetX(value);
    void applyCrop(sourceImage, zoom, value, offsetY);
  }

  function updateOffsetY(value: number) {
    setOffsetY(value);
    void applyCrop(sourceImage, zoom, offsetX, value);
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:border-primary/60 hover:bg-muted"
          onClick={() => pickerRef.current?.click()}
          type="button"
        >
          <ImagePlus size={16} />
          画像を選択
        </button>
      </div>

      <input
        accept={accept}
        className="sr-only"
        onChange={(event) => void loadSelectedFile(event.currentTarget.files?.[0] ?? null)}
        ref={pickerRef}
        type="file"
      />
      <input className="sr-only" name={name} ref={hiddenInputRef} type="file" />

      <div
        className="mt-3 overflow-hidden rounded-md border border-border bg-muted"
        style={{
          aspectRatio,
        }}
      >
        {previewUrl ? (
          <div className="relative h-full w-full">
            <NextImage alt="" className="object-cover" fill sizes="(min-width: 768px) 50vw, 100vw" src={previewUrl} unoptimized />
          </div>
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">画像未選択</div>
        )}
      </div>

      {sourceImage ? (
        <div className="mt-3 grid gap-3">
          <RangeControl label="ズーム" max={2.5} min={1} onChange={updateZoom} step={0.01} value={zoom} />
          <RangeControl label="横位置" max={100} min={0} onChange={updateOffsetX} step={1} value={offsetX} />
          <RangeControl label="縦位置" max={100} min={0} onChange={updateOffsetY} step={1} value={offsetY} />
        </div>
      ) : null}
    </div>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span>{label === "ズーム" ? `${value.toFixed(2)}x` : `${Math.round(value)}%`}</span>
      </span>
      <input
        className="w-full accent-primary"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function readImageDimensions(url: string) {
  return new Promise<{ height: number; width: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function cropImageToBlob({
  aspectRatio,
  image,
  offsetX,
  offsetY,
  outputHeight,
  outputWidth,
  zoom,
}: {
  aspectRatio: number;
  image: SourceImage;
  offsetX: number;
  offsetY: number;
  outputHeight: number;
  outputWidth: number;
  zoom: number;
}) {
  const sourceRatio = image.width / image.height;
  const cropWidth = sourceRatio > aspectRatio ? image.height * aspectRatio : image.width;
  const cropHeight = sourceRatio > aspectRatio ? image.height : image.width / aspectRatio;
  const zoomedCropWidth = cropWidth / zoom;
  const zoomedCropHeight = cropHeight / zoom;
  const maxX = Math.max(0, image.width - zoomedCropWidth);
  const maxY = Math.max(0, image.height - zoomedCropHeight);
  const sourceX = maxX * (offsetX / 100);
  const sourceY = maxY * (offsetY / 100);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const img = await loadImage(image.url);
  if (!img) {
    return null;
  }

  context.drawImage(img, sourceX, sourceY, zoomedCropWidth, zoomedCropHeight, 0, 0, outputWidth, outputHeight);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.88);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
