"use client";

import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Status = "idle" | "uploading" | "done" | "error";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/**
 * Signed browser → Cloudinary artwork upload. Returns the delivered URL through
 * `onChange`; the parent stores it and the server action re-validates it. Nothing
 * is trusted from the client beyond an id/url string (AGENTS).
 */
export function ArtworkUpload({
  value,
  onChange,
  folder = "artwork",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: "artwork";
}) {
  const t = useTranslations("quote");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setStatus("error");
      setError(t("errGeneric"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError(t("errGeneric"));
      return;
    }

    try {
      setStatus("uploading");
      const sigRes = await fetch(`/api/upload-signature?folder=${folder}`);
      if (!sigRes.ok) throw new Error("signature failed");
      const sig = await sigRes.json();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);

      const upRes = await fetch(sig.endpoint, { method: "POST", body: fd });
      if (!upRes.ok) throw new Error("upload failed");
      const json = await upRes.json();
      if (!json.secure_url) throw new Error("no url");
      onChange(json.secure_url as string);
      setStatus("done");
    } catch {
      setStatus("error");
      setError(t("errGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {status === "done" && value ? (
        <div className="flex items-center gap-3 rounded-control border bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t("uploaded")}
            className="size-12 rounded-control object-cover"
          />
          <span className="flex-1 text-sm">{t("uploaded")}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("remove")}
            onClick={() => {
              onChange(null);
              setStatus("idle");
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-2 rounded-control border border-dashed bg-surface px-3 py-2.5 text-sm hover:bg-muted"
        >
          {status === "uploading" ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          <span>
            {status === "uploading"
              ? t("uploading")
              : status === "error"
                ? t("errGeneric")
                : t("uploadArtwork")}
          </span>
        </label>
      )}

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-destructive"
        >
          <ImageIcon className="size-4" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
