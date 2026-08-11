// Downloads a file from a URL by fetching it as a blob (handles cross-origin
// sources that would otherwise just open in a new tab). Falls back to opening
// in a new tab if the fetch is blocked.
export async function downloadUrl(url, filename = "evidence") {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    window.open(url, "_blank");
  }
}