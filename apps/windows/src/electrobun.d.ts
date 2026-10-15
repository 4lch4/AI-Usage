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

  export interface Display {
    bounds: Rectangle
    workArea: Rectangle
    scaleFactor: number
    isPrimary: boolean
  }

  export const Screen: {
    /** Real monitor geometry, unlike the stubbed `Tray.getBounds` on Windows. */
    getPrimaryDisplay(): Display
  }

  export interface NotificationOptions {
    title: string
    body?: string
    subtitle?: string
    silent?: boolean
  }

  export const BuildConfig: {
    getSync(): { isPackaged: boolean; channel: string; defaultRenderer: 'native' | 'cef' }
  }

  export const Utils: {
    /** `%APPDATA%` on Windows. Settings live in a `settings.json` under it. */
    paths: {
      config: string
      appData: string
      temp: string
      /** The installed app root, e.g. `%LOCALAPPDATA%\<identifier>\<channel>`. */
      userData: string
    }
    showNotification(options: NotificationOptions): void
  }

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
    readonly webview: {
      executeJavascript(code: string): void
      /** `__electrobunSendToHost` in the page arrives here. */
      on(event: 'host-message', handler: (event: unknown) => void): void
    }
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
