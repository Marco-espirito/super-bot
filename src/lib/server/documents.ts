import "server-only";

import { Buffer } from "node:buffer";
import mammoth from "mammoth";
import { readSheet } from "read-excel-file/node";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { neutralizePromptInjection, safeFilename, sha256 } from "./security";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 100_000;

export type ExtractedDocument = {
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  text: string;
  pages?: number;
  rows?: number;
  warnings: string[];
};

function extension(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function assertSignature(bytes: Uint8Array, ext: string) {
  const startsWith = (...expected: number[]) => expected.every((value, index) => bytes[index] === value);
  if (ext === ".pdf" && !startsWith(0x25, 0x50, 0x44, 0x46)) throw new Error("Le fichier ne possède pas une signature PDF valide.");
  if ((ext === ".docx" || ext === ".xlsx") && !startsWith(0x50, 0x4b)) throw new Error("Le fichier Office ne possède pas une signature ZIP valide.");
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size <= 0) throw new Error("Le fichier est vide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Le fichier dépasse la limite de 10 Mo.");

  const name = safeFilename(file.name);
  const ext = extension(name);
  const allowed = [".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md", ".json"];
  if (!allowed.includes(ext)) throw new Error("Ce format de fichier n’est pas pris en charge.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  assertSignature(bytes, ext);
  const warnings: string[] = [];
  let text = "";
  let pages: number | undefined;
  let rows: number | undefined;

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractPdfText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    pages = result.totalPages;
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = result.value;
    warnings.push(...result.messages.map((message) => message.message));
  } else if (ext === ".xlsx") {
    const data = await readSheet(Buffer.from(bytes));
    rows = data.length;
    text = data.map((row) => row.map((cell) => String(cell ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (ext === ".json") {
      try { text = JSON.stringify(JSON.parse(text), null, 2); }
      catch { throw new Error("Le fichier JSON est invalide."); }
    }
    if (ext === ".csv") rows = text.replace(/\r/g, "").split("\n").filter(Boolean).length;
  }

  if (!text.trim()) warnings.push("Aucun texte exploitable n’a été trouvé.");
  if (text.length > MAX_EXTRACTED_CHARS) warnings.push("Le texte a été tronqué à 100 000 caractères.");

  return {
    name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sha256: sha256(bytes),
    text: neutralizePromptInjection(text.slice(0, MAX_EXTRACTED_CHARS)),
    pages,
    rows,
    warnings,
  };
}
