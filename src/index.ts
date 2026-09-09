/**
 * Command palette plugin, host half. Registers the `/open-folder` host
 * command (opens a path in the operating-system file manager); the browser
 * half ships the palette UI through the package's dsh.client declaration
 * (`exports["./client"]` → lib/client.js).
 */
import { spawn } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name. */
export const name = 'ui-command-palette'

/** Required host services: the slash-command registry. */
export const inject = ['commands']

/** The OS file-manager opener per platform. */
function opener(): { readonly file: string, readonly args: readonly string[] } | undefined {
  if (process.platform === 'darwin') return { file: 'open', args: [] }
  if (process.platform === 'win32') return { file: 'explorer', args: [] }
  if (process.platform === 'linux') return { file: 'xdg-open', args: [] }
  return undefined
}

/**
 * Host plugin body: register `/open-folder <path>`. The path arrives as the
 * raw argument text (paths with spaces need no quoting).
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.commands.register({
    name: 'open-folder',
    description: 'Open a folder in the operating system file manager',
    recordInput: false,
    handler: (invocation) => {
      const path = invocation.rawInput.trim()
      if (path === '') return { kind: 'error' as const, text: 'Usage: /open-folder <path>' }
      const launch = opener()
      if (launch === undefined) return { kind: 'error' as const, text: `Unsupported platform: ${process.platform}` }
      const child = spawn(launch.file, [...launch.args, path], { stdio: 'ignore', detached: true })
      return new Promise(resolve => {
        child.once('error', () => resolve({ kind: 'error' as const, text: `Could not launch ${launch.file}` }))
        child.once('spawn', () => resolve({ kind: 'success' as const, text: `Opened ${path}` }))
      })
    },
  }), 'ui-command-palette: /open-folder command')
}
