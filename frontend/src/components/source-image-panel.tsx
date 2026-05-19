import { ImageOff, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { useExtractionSourceImage } from '../hooks/use-extraction-source-image';

interface SourceImagePanelProps {
  readonly extractionId: string;
  readonly hasStoredFile: boolean;
  readonly title?: string;
  readonly className?: string;
}

export function SourceImagePanel({
  extractionId,
  hasStoredFile,
  title = 'Stored invoice image',
  className = '',
}: SourceImagePanelProps): ReactElement {
  const { url, loading, error, available } = useExtractionSourceImage(
    extractionId,
    hasStoredFile,
  );

  if (!available) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted ${className}`}
      >
        <ImageOff className="h-5 w-5 shrink-0" aria-hidden />
        <span>No stored image for this extraction (uploaded before file storage).</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-surface p-3 ${className}`}>
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
        </div>
      )}
      {!loading && error !== null && (
        <p className="text-sm text-danger">{error}</p>
      )}
      {!loading && error === null && url !== null && (
        <img
          src={url}
          alt="Stored invoice upload"
          className="mx-auto max-h-96 w-full rounded-md object-contain"
        />
      )}
    </div>
  );
}


