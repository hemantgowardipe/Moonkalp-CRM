export const MAX_FILE_BYTES = 25 * 1024 * 1024;

// The content type is always derived from the extension on the server, never
// trusted from the upload, so only these extensions can be stored or served.
export const ALLOWED_FILE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

export function allowedExtensionList() {
  return Object.keys(ALLOWED_FILE_TYPES).join(", ");
}

function sanitizeFileName(name) {
  // Keep only the base name, collapse whitespace, and drop characters that
  // break headers or file systems.
  const base = String(name).split(/[\\/]/).pop() ?? "";
  return base.replaceAll(/["<>:|?*\u0000-\u001f]/g, "").replaceAll(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * Validates an upload by name and size. Returns the stored metadata: a cleaned
 * display name, the extension, and the content type implied by the extension.
 */
export function validateDeliverableFile({ name, size }) {
  const fileName = sanitizeFileName(name ?? "");
  if (!fileName) return { error: "Choose a file to upload." };

  const extension = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
  const contentType = ALLOWED_FILE_TYPES[extension];
  if (!contentType) {
    return { error: `That file type is not supported. Allowed: ${allowedExtensionList()}.` };
  }

  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return { error: "That file is empty." };
  if (bytes > MAX_FILE_BYTES) {
    return { error: `Files must be ${formatFileSize(MAX_FILE_BYTES)} or smaller.` };
  }

  return { values: { fileName, extension, contentType, sizeBytes: Math.round(bytes) } };
}

/** Where the bytes live in the bucket; the random id keeps paths unguessable. */
export function deliverableStoragePath(deliverableId, fileId, extension) {
  return `${deliverableId}/${fileId}.${extension}`;
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function isPreviewableImage(contentType) {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType);
}

export function parseCommentForm(formData) {
  const body = String(formData.get("body") ?? "").replaceAll("\r\n", "\n").trim();
  if (!body) return { error: "Write a comment first." };
  if (body.length > 2000) return { error: "Comments must be 2,000 characters or fewer." };
  return { values: { body } };
}
