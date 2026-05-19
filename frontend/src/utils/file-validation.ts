const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 20 * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  message?: string;
}

export function validateInvoiceFile(file: File): FileValidationResult {
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      valid: false,
      message: 'Only JPEG, PNG, or WebP images are allowed.',
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      valid: false,
      message: 'File must be smaller than 20 MB.',
    };
  }
  if (file.size === 0) {
    return { valid: false, message: 'File is empty.' };
  }
  return { valid: true };
}
