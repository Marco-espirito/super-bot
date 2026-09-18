import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { extractDocument } from "@/lib/server/documents";
import { isDatabaseConfigured, query } from "@/lib/server/db";
import { assertSameOrigin } from "@/lib/server/security";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine de requête refusée." }, { status: 403 }); }
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier valide n’a été fourni." }, { status: 400 });

  try {
    const document = await extractDocument(file);
    const user = isDatabaseConfigured() ? await getCurrentUser() : null;
    let id: string | null = null;
    if (user) {
      const result = await query<{ id: string }>(
        `INSERT INTO files (user_id, name, mime_type, size_bytes, extracted_text, sha256)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [user.id, document.name, document.mimeType, document.size, document.text, document.sha256],
      );
      id = result.rows[0].id;
    }
    return NextResponse.json({ id, document });
  } catch (error) {
    log("warn", "document_extraction_rejected", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Extraction impossible." }, { status: 422 });
  }
}
