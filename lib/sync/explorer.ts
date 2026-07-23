const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || ""
const MAX_PAGES = 200

export interface EventLog {
  topics: string[]
  data: string
  transactionHash: string
  logIndex: string
  blockNumber: string
}

export interface HolderItem {
  address: { hash: string } | string
  value: string
}

/**
 * Fetch event logs from Blockscout getLogs API for a given topic0, starting from fromBlock.
 */
export async function fetchEventLogs(contractAddress: string, topic0: string, fromBlock: number, topic1?: string): Promise<EventLog[]> {
  if (!contractAddress || !EXPLORER_URL) return []

  let apiUrl = `${EXPLORER_URL}/api?module=logs&action=getLogs&address=${contractAddress}&topic0=${topic0}&fromBlock=${fromBlock}&toBlock=latest`
  if (topic1) apiUrl += `&topic1=${topic1}&topic0_1_opr=and`

  const response = await fetch(apiUrl, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Explorer getLogs returned ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data.result)) return []
  return data.result
}

export interface TransferItem {
  type: string
  to: { hash: string } | null
  total: { value: string } | null
  tx_hash: string
  log_index: number
  block_number: number
}

/**
 * Iterate all transfer pages from Blockscout v2 /transfers endpoint (capped at MAX_PAGES).
 */
export async function fetchAllTransferPages(contractAddress: string): Promise<TransferItem[]> {
  if (!contractAddress || !EXPLORER_URL) return []

  const allItems: TransferItem[] = []
  let url: string | null = `${EXPLORER_URL}/api/v2/tokens/${contractAddress}/transfers`
  let pageCount = 0

  while (url && pageCount < MAX_PAGES) {
    pageCount++
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Explorer transfers returned ${response.status}`)
    }

    const data = await response.json()
    const items = Array.isArray(data.items) ? data.items : []

    for (const item of items) {
      allItems.push({
        type: item.type,
        to: item.to,
        total: item.total,
        tx_hash: item.transaction_hash,
        log_index: item.log_index ?? 0,
        block_number: item.block_number ?? 0,
      })
    }

    if (data.next_page_params) {
      const params = new URLSearchParams()
      for (const [key, val] of Object.entries(data.next_page_params)) {
        params.set(key, String(val))
      }
      url = `${EXPLORER_URL}/api/v2/tokens/${contractAddress}/transfers?${params.toString()}`
    } else {
      url = null
    }
  }

  return allItems
}

/**
 * Iterate holder pages from Blockscout v2 /holders endpoint (capped at MAX_PAGES).
 */
export async function fetchAllHolderPages(contractAddress: string): Promise<HolderItem[]> {
  if (!contractAddress || !EXPLORER_URL) return []

  const allHolders: HolderItem[] = []
  let url: string | null = `${EXPLORER_URL}/api/v2/tokens/${contractAddress}/holders`
  let pageCount = 0

  while (url && pageCount < MAX_PAGES) {
    pageCount++
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Explorer holders returned ${response.status}`)
    }

    const data = await response.json()
    const items = Array.isArray(data.items) ? data.items : []

    for (const holder of items) {
      allHolders.push({
        address: holder.address,
        value: holder.value || "0",
      })
    }

    if (data.next_page_params) {
      const params = new URLSearchParams()
      for (const [key, val] of Object.entries(data.next_page_params)) {
        params.set(key, String(val))
      }
      url = `${EXPLORER_URL}/api/v2/tokens/${contractAddress}/holders?${params.toString()}`
    } else {
      url = null
    }
  }

  return allHolders
}
