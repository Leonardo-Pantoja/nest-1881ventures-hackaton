import { NextResponse } from "next/server";
import { internalRedirect } from "@/lib/auth/internalRedirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = internalRedirect(url.searchParams.get("next"), url.origin);
  if (next === null) return NextResponse.json({ error: "Destino de redirección inválido." }, { status: 400 });

  return NextResponse.redirect(new URL(next, url.origin));
}
