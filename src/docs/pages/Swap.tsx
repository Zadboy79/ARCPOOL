import { Callout, H2, H3, Lead, Table } from '../components'

export function Swap() {
  return (
    <>
      <Lead>
        The Swap page trades USDC, EURC and cirBTC through the liquidity available on Arc, and swaps USDC with rUSDC
        directly against the pool.
      </Lead>

      <H2>Two kinds of swap</H2>
      <Table
        head={['Pair', 'How it is routed', 'Price']}
        rows={[
          ['USDC, EURC, cirBTC between each other', 'Circle App Kit finds a route through an aggregator and DEX pools on Arc.', 'Live quote with a minimum received'],
          ['USDC to rUSDC', 'The pool contract mints rUSDC. Same as staking.', 'The pool entry price'],
          ['rUSDC to USDC', 'The pool contract redeems rUSDC. Same as withdrawing.', 'The pool exit price'],
          ['rUSDC with EURC or cirBTC', 'Not offered. rUSDC pairs with USDC only.', 'None'],
        ]}
      />

      <H2>Market swaps</H2>
      <H3>Quotes</H3>
      <p>
        Connect your wallet, pick the two tokens and type an amount. About half a second after you stop typing the page
        asks for a quote. It shows the amount you will get, the rate, the minimum you will receive after slippage, the
        provider fee, the gas estimate and the route, including the provider and each pool used.
      </p>
      <p>
        Nothing is sent until you press Swap. The quote is only an estimate, so the rate can move before your
        transaction confirms.
      </p>
      <H3>Slippage</H3>
      <p>
        The settings button on the card sets the slippage you accept: 0.5%, 1% (default) or 3%. If the price moves
        beyond it, the swap fails instead of filling at a worse rate.
      </p>
      <H3>Who executes the swap</H3>
      <p>
        Your own wallet signs and sends it. ArcPool never holds your tokens. Market swaps run through a third-party
        aggregator that can change from route to route, so you are subject to its terms. The page names the provider
        in the route details.
      </p>

      <H3>Routing when one pool is not enough</H3>
      <p>
        If no single pool can fill an order, the page looks for a longer route before giving up. It does this only
        after the direct quote has failed.
      </p>
      <Table
        head={['Situation', 'What the router does']}
        rows={[
          ['No direct pool for the pair, for example EURC to cirBTC', 'Goes through USDC: EURC to USDC, then USDC to cirBTC. Two swaps.'],
          ['The order is too big for one pool, for example 30 USDC to cirBTC', 'Cuts the amount into 2 to 6 equal swaps, using the fewest that a pool will fill.'],
        ]}
      />
      <p>
        Every swap is a separate transaction that you confirm in your wallet. They run one after another, and the review
        panel shows the number of confirmations, the estimated total and the minimum total. If a later swap fails, the
        earlier ones stay completed. For the two-step route the second swap uses what the first one actually paid out.
      </p>

      <H2>Price check</H2>
      <p>
        For every market quote the page also asks for the quote in the opposite direction, for exactly the amount you
        would receive, and compares what comes back with what you paid.
      </p>
      <Table
        head={['Round trip returns', 'What the page shows']}
        rows={[
          ['Within 2% of what you paid', 'A green check: price check passed.'],
          ['More than 2% less', 'A warning about a wide spread. Try a smaller amount.'],
          ['More than 2% more', 'A notice that the pool prices the pair inconsistently, so the rate is not a market price.'],
        ]}
      />
      <Callout tone="warn" title="Testnet pools are shallow and can be mispriced">
        When this feature was added, swapping USDC to EURC and straight back on the testnet pool returned about 68% more
        than was put in, and the cirBTC pool only filled buying orders of roughly 0.5 to 10 USDC per swap. Treat testnet rates as test
        data, never as a market price. When no route exists the page says so instead of guessing.
      </Callout>

      <H2>Pool swaps</H2>
      <p>
        Choosing USDC and rUSDC makes Swap behave like the Stake and Withdrawals pages, in one card with a flip button.
        There is no slippage because the price is set by the contract at the moment the transaction runs, and the card
        shows the same preview as the staking form.
      </p>
    </>
  )
}
