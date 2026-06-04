// File parsing — extracts plain text from uploaded documents so every AI agent
// can read them through the context builder.
//
// Real parsing uses optional libraries (pdf-parse, mammoth, xlsx) loaded
// dynamically. If a library or the file type isn't available, we fall back to a
// best-effort UTF-8 read / labeled placeholder so the feature never crashes the
// upload (matching the app's "real + mock fallback" rule).

export interface ParsedFile {
  text: string;
  /** True when a real parser handled the file; false for a fallback. */
  parsed: boolean;
}

const MAX_TEXT_LENGTH = 100_000;

function clamp(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_TEXT_LENGTH
    ? trimmed.slice(0, MAX_TEXT_LENGTH) + "\n…(truncated)"
    : trimmed;
}

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function parseFileToText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ParsedFile> {
  const extension = ext(filename);

  try {
    // Plain-text-like formats: read directly.
    if (
      mimeType.startsWith("text/") ||
      ["txt", "md", "csv", "json", "tsv", "log"].includes(extension)
    ) {
      return { text: clamp(buffer.toString("utf-8")), parsed: true };
    }

    // PDF
    if (extension === "pdf" || mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return { text: clamp(result.text ?? ""), parsed: true };
    }

    // Word (.docx)
    if (
      extension === "docx" ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return { text: clamp(result.value ?? ""), parsed: true };
    }

    // Excel (.xlsx / .xls) and similar spreadsheets
    if (
      ["xlsx", "xls", "ods"].includes(extension) ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("ms-excel")
    ) {
      const xlsx = await import("xlsx");
      const wb = xlsx.read(buffer, { type: "buffer" });
      const parts = wb.SheetNames.map((sheet) => {
        const csv = xlsx.utils.sheet_to_csv(wb.Sheets[sheet]);
        return `# Sheet: ${sheet}\n${csv}`;
      });
      return { text: clamp(parts.join("\n\n")), parsed: true };
    }

    // Legacy .doc and anything else: best-effort UTF-8, stripping control bytes.
    const fallback = buffer
      .toString("utf-8")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");
    const cleaned = clamp(fallback);
    return {
      text:
        cleaned.length > 20
          ? cleaned
          : `(Could not extract text from ${filename}. Unsupported format: ${mimeType || extension}.)`,
      parsed: false,
    };
  } catch (err) {
    console.error(`[file-parse] failed for ${filename}:`, err);
    return {
      text: `(Failed to parse ${filename}.)`,
      parsed: false,
    };
  }
}
