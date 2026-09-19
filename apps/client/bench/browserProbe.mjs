/** Instrumentación para la consola de una instancia local de pruebas; no forma parte del cliente. */
export function startBrowserProbe() {
  const histogram = new Uint32Array(4001)
  const started = performance.now()
  const errors = []
  let frames = 0
  let measuredMs = 0
  let slowFrames = 0
  let last = 0
  let raf = 0
  let longTasks = 0
  let longestTaskMs = 0
  const initialHeap = performance.memory?.usedJSHeapSize ?? null
  const viewport = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }

  const frame = (now) => {
    if (last && !document.hidden) {
      const dt = now - last
      histogram[Math.min(4000, Math.round(dt * 4))]++
      frames++
      measuredMs += dt
      if (dt > 33.4) slowFrames++
    }
    last = document.hidden ? 0 : now
    raf = requestAnimationFrame(frame)
  }
  const visibility = () => {
    last = 0
  }
  const error = (event) => {
    if (errors.length < 20) errors.push({ type: 'error', message: event.message })
  }
  const rejection = (event) => {
    if (errors.length < 20) errors.push({ type: 'rejection', message: String(event.reason).slice(0, 180) })
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTasks++
      longestTaskMs = Math.max(longestTaskMs, entry.duration)
    }
  })
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) observer.observe({ type: 'longtask' })
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('error', error)
  window.addEventListener('unhandledrejection', rejection)
  raf = requestAnimationFrame(frame)

  const percentile = (fraction) => {
    if (!frames) return null
    let count = 0
    for (let i = 0; i < histogram.length; i++) {
      count += histogram[i]
      if (count >= frames * fraction) return i / 4
    }
    return 1000
  }
  const sample = () => ({
    elapsedSeconds: Math.round((performance.now() - started) / 1000),
    visibleFrameSeconds: Number((measuredMs / 1000).toFixed(2)),
    viewport,
    viewportChanged:
      innerWidth !== viewport.width || innerHeight !== viewport.height || devicePixelRatio !== viewport.dpr,
    frames,
    averageFps: measuredMs ? Number(((frames * 1000) / measuredMs).toFixed(2)) : null,
    frameMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
    slowFrames,
    longTasks,
    longestTaskMs: Math.round(longestTaskMs),
    heapBytes: { initial: initialHeap, current: performance.memory?.usedJSHeapSize ?? null },
    errors: [...errors],
  })
  return {
    sample,
    stop() {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('error', error)
      window.removeEventListener('unhandledrejection', rejection)
      return sample()
    },
  }
}
