"use client"

import Image from "next/image"
import { Globe } from "lucide-react"
import { Linkedin, Twitter } from "@/components/ui/brand-icons"

export default function Footer() {
    return (
        <footer className="bg-[var(--bg-secondary)] border-t border-[var(--neon-pink)]/20 mt-auto relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--neon-purple)]/5 to-transparent pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col items-center gap-2">
                    {/* Logos */}
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="https://www.treasurehunt.pt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-80 hover:opacity-100 transition-opacity"
                        >
                            <Image
                                src="/treasure-hunt-only-logo.png"
                                alt="Treasure Hunt"
                                width={140}
                                height={140}
                                className="h-[3rem] sm:h-[4rem] w-auto"
                            />
                        </a>
                        <a
                            href="https://novablockchainlab.novaims.unl.pt/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-80 hover:opacity-100 transition-opacity"
                        >
                            <Image
                                src="/NOVA_Blockchain_Lab-2.png"
                                alt="Nova Blockchain Lab"
                                width={140}
                                height={140}
                                className="h-[3rem] sm:h-[4rem] w-auto"
                            />
                        </a>
                        <a
                            href="https://www.cm-cadaval.pt/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-80 hover:opacity-100 transition-opacity"
                        >
                            <Image
                                src="/cadaval-logo.png"
                                alt="Município de Cadaval"
                                width={268}
                                height={72}
                                className="h-[3rem] sm:h-[4rem] w-auto"
                            />
                        </a>
                        <Image
                            src="/cadaval-festival-logo.webp"
                            alt="Cadaval — Festival da Juventude"
                            width={140}
                            height={140}
                            className="h-[3rem] sm:h-[4rem] w-auto opacity-90"
                        />
                    </div>

                    {/* Social Links */}
                    <div className="flex items-center gap-3">
                        <a
                            href="https://x.com/NovaBlockLab"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--neon-cyan)]/30 text-[var(--text-secondary)] hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)] transition-all hover:shadow-[var(--glow-cyan)]"
                        >
                            <Twitter className="w-4 h-4" />
                            <span className="text-xs font-medium">X</span>
                        </a>
                        <a
                            href="https://www.linkedin.com/company/nova-blockchain-lab/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--neon-pink)]/30 text-[var(--text-secondary)] hover:text-[var(--neon-pink)] hover:border-[var(--neon-pink)] transition-all hover:shadow-[var(--glow-pink)]"
                        >
                            <Linkedin className="w-4 h-4" />
                            <span className="text-xs font-medium">LinkedIn</span>
                        </a>
                        <a
                            href="https://novablockchainlab.novaims.unl.pt/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--neon-purple)]/30 text-[var(--text-secondary)] hover:text-[var(--neon-purple)] hover:border-[var(--neon-purple)] transition-all hover:shadow-[var(--glow-purple)]"
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-xs font-medium">Website</span>
                        </a>
                    </div>

                    {/* Copyright */}
                    <div className="text-center pt-2 border-t border-[var(--neon-pink)]/10 w-full">
                        <p className="text-[var(--text-muted)] text-[10px]">
                            {new Date().getFullYear()} Nova Blockchain Lab &middot; <a href="https://www.treasurehunt.pt" target="_blank" rel="noopener" className="hover:underline">Built with Treasure Hunt</a>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    )
}
