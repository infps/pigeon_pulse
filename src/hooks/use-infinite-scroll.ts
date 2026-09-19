"use client"

import { useRef, useEffect, useCallback } from "react"

// ponytail: native IntersectionObserver, no lib needed
export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useCallback(onLoadMore, [onLoadMore])

  useEffect(() => {
    if (!enabled || !ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) cb() }, { threshold: 0 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [enabled, cb])

  return ref
}
