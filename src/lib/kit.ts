import type { AppKit } from '@circle-fin/app-kit'

let kitPromise: Promise<AppKit> | undefined

/** The App Kit is loaded on first use so pages that never swap or browse vaults stay light. */
export function getKit(): Promise<AppKit> {
  kitPromise ??= import('@circle-fin/app-kit').then((mod) => new mod.AppKit())
  return kitPromise
}
