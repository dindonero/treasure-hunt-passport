import { readFileSync } from "fs"
import { join } from "path"
import {
  COMPILER_VERSION, EVM_VERSION, OPTIMIZATION_ENABLED,
  OPTIMIZATION_RUNS, CONTRACT_NAME,
} from "./verification"

const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").trim()
const RETRY_DELAY_MS = 5_000
const MAX_RETRIES = 3

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Verify a contract on Blockscout using flattened source code.
 * Retries with delay to handle the explorer not having indexed the contract yet.
 * Returns true if verification succeeded.
 */
export async function verifyOnExplorer(contractAddress: string): Promise<boolean> {
  if (!EXPLORER_URL) return false

  const flattenedSource = readFileSync(
    join(process.cwd(), "lib/contracts/TreasureHuntRewards.flattened.sol"),
    "utf-8",
  )

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Wait for explorer to index the contract
      if (attempt > 1) {
        console.log(`[verify] Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms...`)
      }
      await delay(RETRY_DELAY_MS)

      const formData = new FormData()
      formData.append("compiler_version", COMPILER_VERSION)
      formData.append("source_code", flattenedSource)
      formData.append("contract_name", CONTRACT_NAME)
      formData.append("is_optimization_enabled", String(OPTIMIZATION_ENABLED))
      formData.append("optimization_runs", String(OPTIMIZATION_RUNS))
      formData.append("evm_version", EVM_VERSION)
      formData.append("autodetect_constructor_args", "true")

      const res = await fetch(
        `${EXPLORER_URL}/api/v2/smart-contracts/${contractAddress}/verification/via/flattened-code`,
        { method: "POST", body: formData },
      )

      if (res.ok) {
        console.log("[verify] Contract verified on explorer")
        return true
      }

      const body = await res.text()
      // 404 means explorer hasn't indexed the contract yet — worth retrying
      if (res.status === 404 && attempt < MAX_RETRIES) {
        console.warn(`[verify] Explorer returned 404 (not indexed yet), will retry...`)
        continue
      }

      console.warn("[verify] Verification response:", res.status, body)
      return false
    } catch (err) {
      console.warn(`[verify] Attempt ${attempt} failed:`, err)
      if (attempt === MAX_RETRIES) return false
    }
  }

  return false
}
