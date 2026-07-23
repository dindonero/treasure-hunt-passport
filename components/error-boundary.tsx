"use client"

import React from "react"
import { AlertCircle, Home, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen hero-gradient flex flex-col items-center justify-center p-4 relative overflow-hidden">
          <div className="blob-pink top-10 -left-40 opacity-30" />
          <div className="blob-cyan bottom-20 -right-40 opacity-30" />

          <div className="glass-card p-8 max-w-md w-full text-center relative z-10">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>

            <h1
              className="text-2xl font-bold text-white mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SOMETHING WENT WRONG
            </h1>

            <p className="text-[var(--text-secondary)] mb-6">
              An unexpected error occurred. You can try again or go back to the home page.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="text-left text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3">
              <Button
                onClick={this.handleRetry}
                className="flex-1 btn-neon-cyan"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex-1 border-[var(--neon-pink)]/30 text-[var(--neon-pink)]"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
