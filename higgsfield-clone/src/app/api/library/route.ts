import { NextResponse } from "next/server";
import { deleteItem, readLibrary } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readLibrary());
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
