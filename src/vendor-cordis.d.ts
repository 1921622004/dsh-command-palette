/**
 * Minimal structural declaration of the vendored cordis faces the plugin's
 * host half consumes. The real package resolves at runtime inside the dsh
 * profile (peerDependencies); this keeps the out-of-tree typecheck honest
 * without depending on the harness checkout.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    effect(register: () => () => void, label?: string): void
    readonly commands: {
      register(definition: {
        readonly name: string
        readonly description: string
        readonly recordInput?: boolean
        readonly handler: (invocation: { readonly rawInput: string }) =>
          | { readonly kind: 'success', readonly text?: string }
          | { readonly kind: 'error', readonly text: string }
          | Promise<{ readonly kind: 'success', readonly text?: string } | { readonly kind: 'error', readonly text: string }>
      }): () => void
    }
  }
}
