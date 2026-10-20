"use client";

import { FileText, Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { requestArtworkUpload } from "@/app/[locale]/(site)/quote/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { QUOTE_ATTACHMENT_BUCKET } from "@/lib/validators/quote-attachment";

type Status = "idle" | "uploading" | "done" | "error";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — matches the bucket file_size_limit
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

/**
 * Plan 15.2 B6 — private artwork upload. The server mints a random
 * `<yyyy>/<uuid>.<ext>` path and a signed upload URL; we PUT the bytes
 * straight to the private `quote-attachments` bucket with the browser SDK,
 * then hand the OBJECT PATH (never a public URL) back to the form. The object
 * is private, so there is no preview image — we show the file name instead.
 * The server action re-validates the path and confirms the object exists.
 */
export function ArtworkUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const t = useTranslations("quote");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    onChange(null);
    setStatus("idle");
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setStatus("error");
      setError(t("errFileType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError(t("errFileTooLarge"));
      return;
    }

    try {
      setStatus("uploading");
      const res = await requestArtworkUpload({ mimeType: file.type });
      if (!res.ok) {
        setStatus("error");
        setError(
          res.error === "rate_limited" ? t("errRateLimited") : t("errGeneric"),
        );
        return;
      }

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(QUOTE_ATTACHMENT_BUCKET)
        .uploadToSignedUrl(res.path, res.token, file, {
          contentType: file.type,
        });
      if (upErr) throw upErr;

      setFileName(file.name);
      onChange(res.path);
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
          <FileText className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm" title={fileName}>
            {fileName || t("uploaded")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("remove")}
            onClick={reset}
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
          <FileText className="size-4" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
