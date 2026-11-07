import { Loader2 } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import type { TxPhase } from '@/hooks/useTxFlow'

interface TxButtonProps {
  label: string
  onClick: () => void | Promise<void>
  phase: TxPhase
  isConnected: boolean
  wrongChain: boolean
  isSwitching: boolean
  onSwitch: () => void | Promise<void>
  disabled?: boolean
}

export function TxButton({
  label,
  onClick,
  phase,
  isConnected,
  wrongChain,
  isSwitching,
  onSwitch,
  disabled,
}: TxButtonProps) {
  if (!isConnected) {
    return (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <button type="button" onClick={show} className="btn-primary">
            Connect wallet
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  }

  if (wrongChain) {
    return (
      <button type="button" onClick={() => void onSwitch()} disabled={isSwitching} className="btn-primary">
        {isSwitching ? <Loader2 className="size-4 animate-spin" /> : null}
        Switch to Arc Testnet
      </button>
    )
  }

  const busy = phase !== 'idle'
  return (
    <button type="button" onClick={() => void onClick()} disabled={disabled || busy} className="btn-primary">
      {phase === 'wallet' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Confirm in wallet...
        </>
      ) : phase === 'processing' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Swapping...
        </>
      ) : phase === 'confirming' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Confirming...
        </>
      ) : (
        label
      )}
    </button>
  )
}
