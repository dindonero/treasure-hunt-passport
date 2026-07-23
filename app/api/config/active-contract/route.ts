import { NextResponse } from "next/server"
import { getActiveContract } from "@/lib/contracts/active-contract"

export async function GET() {
  const { address, deployBlock } = await getActiveContract()
  return NextResponse.json({ address, deployBlock }, {
    headers: { "Cache-Control": "no-store" },
  })
}
