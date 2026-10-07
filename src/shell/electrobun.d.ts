// The slice of Electrobun's main-process SDK this app uses. Hutch generates the real types at
// build time; this keeps `tsc` and CI working without running a build first.
declare module 'electrobun/main' {
  interface Rectangle {
    x: number
    y: number
    width: number
    height: number
  }

  type TrayMenuItem =
    | { type: 'normal'; label: string; action: string; enabled?: boolean }
    | { type: 'separator' }

  export class Tray {
    constructor(options: {
      title?: string
      image?: string
      template?: boolean
      width?: number
      height?: number
    })
    setTitle(title: string): void
    setImage(image: string): void
    setMenu(items: TrayMenuItem[]): void
    getBounds(): Rectangle
    on(event: 'tray-clicked', handler: (event: unknown) => void): void
    remove(): void
  }

  export class BrowserWindow {
    constructor(options: {
      title?: string
      html?: string
      frame?: Partial<Rectangle> & { width: number; height: number }
      titleBarStyle?: 'default' | 'hidden' | 'hiddenInset'
    })
    readonly webview: { executeJavascript(code: string): void }
    on(event: string, handler: (event: unknown) => void): void
    setFrame(x: number, y: number, width: number, height: number): void
    setAlwaysOnTop(value: boolean): void
    center(): void
    show(): void
    hide(): void
    activate(): void
    close(): void
  }
}
