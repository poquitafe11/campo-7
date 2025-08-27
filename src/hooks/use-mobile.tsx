import * as React from "react"

// Defines a breakpoint for mobile devices based on pointer capabilities instead of just screen width.
// This provides a more reliable way to distinguish between touch-first devices (like phones/tablets)
// and pointer-first devices (like desktops with a mouse). Phones in landscape mode will still
// be correctly identified as "mobile".
const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => {
      setIsMobile(mql.matches)
    }

    // Set initial value
    onChange();

    // Listen for changes
    mql.addEventListener("change", onChange)

    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Return !!isMobile to ensure it's always a boolean (true/false)
  return !!isMobile
}
