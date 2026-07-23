"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const fallback = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""

const ContractAddressContext = createContext<string>(fallback)

export function ContractAddressProvider({ children }: { children: ReactNode }) {
  const [contractAddress, setContractAddress] = useState(fallback)

  useEffect(() => {
    fetch("/api/config/active-contract")
      .then((res) => res.json())
      .then((data) => {
        if (data.address) setContractAddress(data.address)
      })
      .catch((err) => console.error("Failed to fetch active contract:", err))
  }, [])

  return (
    <ContractAddressContext.Provider value={contractAddress}>
      {children}
    </ContractAddressContext.Provider>
  )
}

export function useContractAddress(): string {
  return useContext(ContractAddressContext)
}
