import { ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID, USDC_DECIMALS } from '@/lib/pool'
import { formatApr, formatFixed } from '@/lib/format'
import { Link } from '@/lib/router'
import { useConvert } from '@/hooks/useConvert'
import { useNow } from '@/hooks/useNow'
import { AmountField } from '@/components/AmountField'
import { CubeArt } from '@/components/CubeArt'
import { Faq } from '@/components/Faq'
import { PageTitle } from '@/components/PageTitle'
import { PositionCard } from '@/components/PositionCard'
import { StatsPanel } from '@/components/StatsPanel'
import { UpdatePoolBanner } from '@/components/UpdatePoolBanner'
import { StrategyPanel } from '@/components/StrategyPanel'
import { TxButton } from '@/components/TxButton'
import { UsdcIcon } from '@/components/TokenIcons'
import type { PageProps } from './types'

export function StakePage({ data, isLoading, refetch }: PageProps) {
  const stake = useConvert('stake', data, refetch)
  const now = useNow()
  const { flow } = stake

  const apr = data.streamAprBps !== undefined && data.streamAprBps > 0n ? formatApr(data.streamAprBps) : undefined
  const feePercent = data.commissionBps !== undefined ? data.commissionBps / 100 : undefined

  return (
    <div className="page-col">
      <PageTitle title="Stake USDC" subtitle="Stake USDC and receive rUSDC while staking" />

      <section className="card p-6">
        <AmountField
          value={stake.input}
          onChange={stake.setInput}
          symbol="USDC"
          icon={<UsdcIcon />}
          balanceText={stake.problem ?? stake.balanceText}
          invalid={stake.problem !== null}
          onMax={flow.isConnected ? stake.setMax : undefined}
        />

        <div className="mt-4">
          <TxButton
            label={stake.ctaLabel}
            onClick={stake.onAction}
            phase={flow.phase}
            isConnected={flow.isConnected}
            wrongChain={flow.wrongChain}
            isSwitching={flow.isSwitching}
            onSwitch={flow.switchToArc}
            disabled={!stake.canSubmit}
          />
        </div>

        <Link
          to="/earn"
          className="relative mt-4 block overflow-hidden rounded-xl p-5 transition-[filter] hover:brightness-110"
          style={{
            background: 'linear-gradient(110deg, rgba(0,163,255,0.22), rgba(133,110,240,0.28))',
            border: '1px solid rgba(133,110,240,0.5)',
          }}
        >
          <p className="max-w-[62%] text-base font-extrabold leading-snug" style={{ color: 'var(--text)' }}>
            {apr !== undefined ? `Earn ${apr} APR` : 'Rewards stream to every staker'}
            <br />
            with rUSDC
          </p>
          <CubeArt className="pointer-events-none absolute -right-2 -top-2 size-28" />
        </Link>

        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="row-label">You will receive</dt>
            <dd className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {stake.preview !== undefined ? formatFixed(stake.preview, stake.previewDecimals, 4) : '0.0'} rUSDC
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="row-label">Exchange rate</dt>
            <dd className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {data.exchangeRate !== undefined ? `1 rUSDC = ${formatFixed(data.exchangeRate, USDC_DECIMALS, 6)} USDC` : '...'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="row-label">Reward fee</dt>
            <dd className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {feePercent !== undefined ? `${feePercent}%` : '...'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="row-label">Unstaking</dt>
            <dd className="font-semibold" style={{ color: 'var(--text)' }}>
              Instant if vaults can pay
            </dd>
          </div>
        </dl>

        {flow.lastHash ? (
          <a
            href={buildTxExplorerUrl(CHAIN_ID, flow.lastHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="link mt-5 inline-flex items-center gap-1 text-xs"
          >
            Latest transaction <ExternalLink className="size-3" />
          </a>
        ) : null}
      </section>

      <div className="mt-6">
        <PositionCard data={data} refetch={refetch} hideWhenDisconnected />
      </div>
      <UpdatePoolBanner data={data} refetch={refetch} />
      <StatsPanel data={data} isLoading={isLoading} nowSeconds={now} />
      <StrategyPanel data={data} refetch={refetch} />
      <Faq />
    </div>
  )
}
