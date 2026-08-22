import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

interface QuestionImageProps {
  questionId: number;
  /** Fetches the bytes for the current role; returns an object URL to revoke. */
  load: (questionId: number) => Promise<string>;
  className?: string;
  alt?: string;
}

/**
 * Renders a question's image.
 *
 * The API is Bearer-authenticated, so the bytes cannot be handed to <img src>
 * directly - they are fetched, turned into an object URL, and revoked when the
 * question changes or the view unmounts. Without that revoke every question a
 * student pages through would leak its image for the life of the attempt.
 */
export function QuestionImage({ questionId, load, className = '', alt = 'Question image' }: QuestionImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setObjectUrl(null);
    setFailed(false);
    load(questionId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setObjectUrl(url);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [questionId, load]);

  if (failed) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500 ${className}`}>
        <ImageOff className="size-4 flex-shrink-0" />
        This question&apos;s image could not be loaded.
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-400 ${className}`}>
        <Loader2 className="size-4 flex-shrink-0 animate-spin" />
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`max-h-80 w-auto max-w-full rounded-lg border border-gray-200 object-contain ${className}`}
    />
  );
}
