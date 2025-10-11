/**
 * Initiates a text file download by creating a temporary anchor element.
 * @param {string} filename - Target filename that will be suggested to the browser.
 * @param {BlobPart} data - Text content that will be serialized into the downloadable file.
 * @param {string} [mimeType] - MIME type applied to the generated Blob.
 * @returns {void}
 */
export function downloadTextFile(filename, data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  (document.body || document.documentElement).append(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
