"use client";

import { useState, useEffect } from "react";

export default function useImage(
  url: string | null | undefined,
  crossOrigin?: string
): [HTMLImageElement | undefined, "loading" | "loaded" | "failed"] {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    if (!url) {
      setImage(undefined);
      setStatus("failed");
      return;
    }

    let isCancelled = false;
    setStatus("loading");

    const img = new window.Image();
    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }

    img.onload = () => {
      if (isCancelled) return;
      setImage(img);
      setStatus("loaded");
    };

    img.onerror = () => {
      if (isCancelled) return;
      // If failed with crossOrigin, fallback to standard image load without crossOrigin
      if (crossOrigin) {
        const fallbackImg = new window.Image();
        fallbackImg.onload = () => {
          if (isCancelled) return;
          setImage(fallbackImg);
          setStatus("loaded");
        };
        fallbackImg.onerror = () => {
          if (isCancelled) return;
          setStatus("failed");
        };
        fallbackImg.src = url;
      } else {
        setStatus("failed");
      }
    };

    img.src = url;

    return () => {
      isCancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url, crossOrigin]);

  return [image, status];
}
