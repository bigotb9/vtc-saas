import { NextRequest, NextResponse } from "next/server"
import { requireSaasAdmin } from "@/lib/saasAuth"

export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ admin })
}
