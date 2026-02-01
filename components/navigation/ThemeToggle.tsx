"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { SunIcon, MoonIcon } from "@hugeicons/core-free-icons"

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false)
    const { setTheme, resolvedTheme } = useTheme()

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/50 bg-background/50 backdrop-blur-md">
                <HugeiconsIcon icon={SunIcon} strokeWidth={1.5} className="size-4 text-muted-foreground/40" />
            </Button>
        )
    }

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="group relative h-10 w-10 rounded-2xl border-border/50 bg-accent/20 backdrop-blur-xl transition-all duration-500 hover:border-primary/50 hover:bg-primary/10 shadow-lg shadow-background/20"
        >
            <div className="relative flex items-center justify-center">
                <HugeiconsIcon
                    icon={SunIcon}
                    strokeWidth={1.5}
                    className="size-4 rotate-0 scale-100 transition-all duration-500 group-hover:text-primary dark:-rotate-90 dark:scale-0"
                />
                <HugeiconsIcon
                    icon={MoonIcon}
                    strokeWidth={1.5}
                    className="absolute size-4 rotate-90 scale-0 transition-all duration-500 group-hover:text-primary dark:rotate-0 dark:scale-100"
                />
            </div>
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
