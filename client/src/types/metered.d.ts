export {}

declare global {
  interface Window {
    Metered?: {
      Meeting: new () => any
    }
  }
}
