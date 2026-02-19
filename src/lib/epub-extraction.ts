export interface EpubChapter {
  html: string;
  startWordIndex: number;
  endWordIndex: number;
}

export interface EpubImage {
  path: string;
  data: ArrayBuffer;
}

export interface EpubExtractionResult {
  text: string;
  chapters: EpubChapter[];
  images: EpubImage[];
}

export async function extractEpub(
  buffer: ArrayBuffer
): Promise<EpubExtractionResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  // Parse container.xml to find the OPF path
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("Invalid EPUB: missing container.xml");

  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("Invalid EPUB: no rootfile path");

  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";

  // Parse OPF to get manifest and spine
  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Invalid EPUB: missing OPF file");

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  // Build manifest map: id → { href, mediaType }
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const item of opfDoc.querySelectorAll("manifest > item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";
    if (id && href) {
      manifest.set(id, { href, mediaType });
    }
  }

  // Collect images from manifest
  const images: EpubImage[] = [];
  for (const { href, mediaType } of manifest.values()) {
    if (!mediaType.startsWith("image/")) continue;
    const fullPath = opfDir + decodeURIComponent(href);
    const file = zip.file(fullPath);
    if (!file) continue;
    const data = await file.async("arraybuffer");
    images.push({ path: fullPath, data });
  }

  // Get spine order (reading order)
  const spineIds: string[] = [];
  for (const itemref of opfDoc.querySelectorAll("spine > itemref")) {
    const idref = itemref.getAttribute("idref");
    if (idref) spineIds.push(idref);
  }

  // Process each chapter
  const chapters: EpubChapter[] = [];
  const allWords: string[] = [];
  let globalWordIndex = 0;

  for (const id of spineIds) {
    const entry = manifest.get(id);
    if (!entry || !entry.mediaType.includes("html")) continue;

    const chapterPath = opfDir + decodeURIComponent(entry.href);
    const chapterDir = chapterPath.includes("/")
      ? chapterPath.slice(0, chapterPath.lastIndexOf("/") + 1)
      : "";
    const html = await zip.file(chapterPath)?.async("text");
    if (!html) continue;

    const doc = parser.parseFromString(html, "application/xhtml+xml");
    if (!doc.body) continue;

    // Rewrite image src attributes to use normalized zip paths
    for (const img of doc.querySelectorAll("img")) {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      const resolved = resolvePath(chapterDir, src);
      img.setAttribute("src", `epub-image://${resolved}`);
    }

    // Remove <script> tags
    for (const s of doc.querySelectorAll("script")) {
      s.remove();
    }

    // Walk text nodes, wrap each word in a span
    const startIdx = globalWordIndex;
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.trim()) {
        textNodes.push(node);
      }
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      const parts = text.split(/(\s+)/);
      const parent = textNode.parentNode;
      if (!parent) continue;

      const fragment = doc.createDocumentFragment();
      for (const part of parts) {
        if (/^\s+$/.test(part) || part === "") {
          fragment.appendChild(doc.createTextNode(part));
          continue;
        }
        const span = doc.createElement("span");
        span.setAttribute("data-word-index", String(globalWordIndex));
        span.textContent = part;
        fragment.appendChild(span);
        allWords.push(part);
        globalWordIndex++;
      }
      parent.replaceChild(fragment, textNode);
    }

    const endIdx = globalWordIndex - 1;
    if (endIdx < startIdx) continue;

    // Serialize back to HTML
    const serializer = new XMLSerializer();
    const bodyHtml = serializer.serializeToString(doc.body);
    chapters.push({
      html: bodyHtml,
      startWordIndex: startIdx,
      endWordIndex: endIdx,
    });
  }

  return {
    text: allWords.join(" "),
    chapters,
    images,
  };
}

function resolvePath(base: string, relative: string): string {
  // Handle absolute paths within the zip
  if (relative.startsWith("/")) return relative.slice(1);

  const parts = (base + relative).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}

// Keep backward-compatible export for the simple text extraction
export async function extractEpubText(
  buffer: ArrayBuffer
): Promise<string> {
  const result = await extractEpub(buffer);
  return result.text;
}
