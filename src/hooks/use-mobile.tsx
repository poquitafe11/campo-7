
"use client";
import * as React from "react"

// This hook is no longer needed as we are unifying the UI to a single responsive layout.
// It is kept here to avoid breaking any potential transitive dependencies, but it should be considered deprecated.
export function useIsMobile() {
  return false;
}
