"use client"

import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import ResponsiveModal from "@/components/responsive-modal"

interface TransactionModalProps {
    isOpen: boolean
    onClose: () => void
    status: "success" | "error"
    txHash?: string
    message: string
    isMerch?: boolean
    merchImage?: string
}

export default function TransactionModal({
                                             isOpen,
                                             onClose,
                                             status,
                                             txHash,
                                             message,
                                             isMerch = false,
                                             merchImage,
                                         }: TransactionModalProps) {
    const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.explorer.novaims.unl.pt"
    const txUrl = txHash ? `${explorerUrl}/tx/${txHash}` : null

    const [time, setTime] = useState<{ hours: number; minutes: number; seconds: number }>(() => {
        const now = new Date()
        return {
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
        }
    })
    const [elapsedSeconds, setElapsedSeconds] = useState(0)

    useEffect(() => {
        if (!isMerch || !isOpen || status !== "success") return

        const startTime = Date.now()

        const timer = setInterval(() => {
            const now = new Date()
            setTime({
                hours: now.getHours(),
                minutes: now.getMinutes(),
                seconds: now.getSeconds(),
            })
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)

        const autoCloseTimer = setTimeout(() => {
            onClose()
        }, 30 * 60 * 1000) // 30 minutes

        return () => {
            clearInterval(timer)
            clearTimeout(autoCloseTimer)
            setElapsedSeconds(0)
        }
    }, [isMerch, isOpen, status, onClose])

    const getTimerColor = () => {
        if (elapsedSeconds >= 1500) return "#EF4444" // red: 25-30 min
        if (elapsedSeconds >= 1200) return "#F59E0B" // yellow: 20-25 min
        return "#9FD356" // green: 0-20 min
    }

    const getIconColor = () => {
        if (isMerch) return "#9FD356"
        return "hsl(var(--accent))"
    }

    const getTitle = () => {
        if (status !== "success") return "Transaction Failed"
        return "Transaction Successful!"
    }

    return (
        <ResponsiveModal
            isOpen={isOpen}
            onClose={onClose}
            title={getTitle()}
            description={message}
            className="sm:max-w-md bg-card border-border"
        >
            <div className="flex flex-col items-center">
                <div
                    className={`flex items-center justify-center mb-4 ${isMerch && status === "success" ? "animate-pulse" : ""}`}
                >
                    {status === "success" ? (
                        <div className="relative w-16 h-16">
                            {/* Inner static ring with glow */}
                            <div className="absolute inset-0 rounded-full bg-[#9FD356]/10 blur-md" />

                            {/* Outer rotating ring */}
                            <svg className="absolute inset-0 w-16 h-16 animate-spin" style={{ animationDuration: '3s' }}>
                                <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    fill="none"
                                    stroke={getIconColor()}
                                    strokeWidth="2"
                                    strokeDasharray="140 40"
                                    opacity="0.6"
                                />
                                {/* Bright glowing dot at top of ring */}
                                <circle
                                    cx="32"
                                    cy="4"
                                    r="3"
                                    fill={getIconColor()}
                                    className="drop-shadow-[0_0_8px_rgba(159,211,86,0.8)]"
                                />
                            </svg>

                            {/* Center icon */}
                            <div className="absolute inset-0 rounded-full flex items-center justify-center bg-[#9FD356]/20">
                                <CheckCircle2 className="w-10 h-10 text-[#9FD356]" />
                            </div>
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-destructive" />
                        </div>
                    )}
                </div>

                {isMerch && status === "success" && (
                    <div className="mt-2 mb-4 p-4 rounded-lg w-full transition-colors duration-500" style={{ backgroundColor: `${getTimerColor()}15`, borderWidth: 1, borderStyle: "solid", borderColor: `${getTimerColor()}50` }}>
                        {merchImage && (
                            <img src={merchImage} alt="Purchased item" className="w-24 h-24 object-cover rounded-lg mx-auto mb-3" />
                        )}
                        <p className="text-center font-semibold mb-3 transition-colors duration-500" style={{ color: getTimerColor() }}>
                            {elapsedSeconds >= 1500 ? "Hurry! Expiring soon" : "Please do not close this window"}
                        </p>
                        <p className="text-center text-white text-sm mb-3">Show this message at the Nova IMS booth</p>
                        <div className="text-center">
                            <p className="text-2xl font-bold font-mono transition-colors duration-500" style={{ color: getTimerColor() }}>
                                {String(time.hours).padStart(2, "0")}:{String(time.minutes).padStart(2, "0")}:
                                {String(time.seconds).padStart(2, "0")}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col w-full">
                    {!isMerch && (
                        <Button
                            onClick={onClose}
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide shadow-[0_0_20px_rgba(240,96,93,0.25)] hover:shadow-[0_0_28px_rgba(240,96,93,0.45)] transition-shadow cursor-pointer"
                            autoFocus
                        >
                            {status === "success" ? "Back to the hunt" : "Close"}
                        </Button>
                    )}

                    {status === "success" && txUrl && txHash && !isMerch && (
                        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-2.5">
                            <p className="text-xs text-center text-muted-foreground leading-relaxed px-2">
                                Curious how it works under the hood? Every reward is a real on-chain transaction.
                            </p>
                            <a
                                href={txUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="View transaction on Blockscout block explorer"
                                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border hover:border-[#9FD356]/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FD356]/60"
                            >
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                        Tx hash
                                    </span>
                                    <span className="text-xs font-mono text-foreground truncate w-full">
                                        {txHash.slice(0, 10)}…{txHash.slice(-8)}
                                    </span>
                                </div>
                                <span className="flex items-center gap-1.5 text-xs font-medium text-[#9FD356] shrink-0">
                                    Blockscout
                                    <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </ResponsiveModal>
    )
}
