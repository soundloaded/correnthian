export type ProductPoint = {
  title: string
  body: string
}

export type ProductStep = {
  title: string
  body: string
}

export type ProductColumn = {
  title: string
  items: readonly string[]
}

export type ProductFaq = {
  question: string
  answer: string
}

export type ProductPanel = {
  title: string
  rows: readonly { label: string; value: string }[]
}

export type ProductPage = {
  slug: string
  label: string
  detail: string
  title: string
  description: string
  lede: string
  /** Short line above the title, the way a product page names its section. */
  eyebrow: string
  points: readonly ProductPoint[]
  steps: readonly ProductStep[]
  columnsTitle: string
  columns: readonly ProductColumn[]
  faqs: readonly ProductFaq[]
  related: readonly string[]
  panel: ProductPanel
  note?: string
}

export type ProductGroup = {
  label: string
  items: readonly ProductPage[]
}

/**
 * Public pages for features a holder actually opens.
 * A spend card, a yield, minting, and an exchange are not here.
 */
export const productGroups: readonly ProductGroup[] = [
  {
    label: 'Buy, hold & move',
    items: [
      {
        slug: 'buy',
        label: 'Buy gold',
        detail: 'Card or bank, when a provider is contracted',
        title: 'Buy gold',
        eyebrow: 'Products',
        description: 'How a card or bank purchase delivers metal to an account only you can move.',
        lede: 'A card or a bank transfer is a separate path from a swap. A licensed provider takes the payment and delivers the metal to an account only you can move.',
        panel: {
          title: 'Before you pay',
          rows: [
            { label: 'Provider', value: 'Their fee, on the quote' },
            { label: 'Network', value: 'The chain fee, on the quote' },
            { label: 'Correnthian', value: 'Our fee, on the quote' },
          ],
        },
        steps: [
          { title: 'Choose an amount', body: 'The buy screen is where a purchase starts. It does not move money by itself.' },
          { title: 'A provider takes the payment', body: 'The provider runs the check, takes the card or the transfer, and delivers the tokens.' },
          { title: 'Read the three lines', body: 'Provider, network, and Correnthian are itemised. Nothing is folded into a worse rate.' },
          { title: 'Metal arrives with you', body: 'Delivery is to an address you control. Correnthian cannot move that balance.' },
        ],
        points: [
          { title: 'Correnthian does not see the card', body: 'The provider takes the payment. The card number does not come to this platform.' },
          { title: 'Fiat stays with the provider', body: 'Correnthian does not hold the dollars, the bank account, or the card.' },
          { title: 'No published percentage yet', body: 'The three lines are the rule. A rate is not printed until that schedule is set.' },
        ],
        columnsTitle: 'Two ways in',
        columns: [
          { title: 'Card or bank', items: ['A licensed provider takes the payment', 'You review their terms on the quote', 'The screen stays closed until a provider is contracted'] },
          { title: 'Assets you already hold', items: ['That path is a swap, not a card purchase', 'The server prepares a quote', 'Your device signs before anything moves'] },
        ],
        faqs: [
          { question: 'Can I buy gold with a card today?', answer: 'No. No on-ramp provider is contracted, so the buy screen refuses a purchase and says so.' },
          { question: 'Who takes the payment?', answer: 'A licensed provider. Correnthian shows the provider and the fee lines. It does not take the card or the bank transfer itself.' },
          { question: 'Where does the gold go?', answer: 'To an account only you can move. The buy screen is not a balance Correnthian holds.' },
          { question: 'Is the price marked up?', answer: 'Fees are three named lines, shown before you pay. They are not hidden inside a worse rate. No percentage is published yet.' },
        ],
        related: ['swap', 'gold', 'portfolio'],
        note: 'No on-ramp provider is contracted yet. Joining the waitlist is how to ask for access.',
      },
      {
        slug: 'swap',
        label: 'Swap',
        detail: 'Move assets you already hold into gold',
        title: 'Swap into gold',
        eyebrow: 'Products',
        description: 'A quote turns assets you already hold into gold. Your device signs. The server does not.',
        lede: 'If you already hold assets, a swap is the path into gold in the same account. The server can prepare a quote. Your device signs it. A quote does not move funds.',
        panel: {
          title: 'A quote, then a signature',
          rows: [
            { label: 'Quote', value: 'A price, not a trade' },
            { label: 'Prepare', value: 'Unsigned, on the server' },
            { label: 'Sign', value: 'On your device' },
          ],
        },
        steps: [
          { title: 'Ask for a quote', body: 'The quote prices a move from one asset to another. Nothing is sent.' },
          { title: 'Read the limit', body: 'If liquidity is thin, or no provider is contracted, the quote stays closed.' },
          { title: 'Sign on your device', body: 'The server assembles the approve and the swap. It has no key that could sign them.' },
          { title: 'Gold stays in your account', body: 'The result is the same account, now holding the gold the quote described.' },
        ],
        points: [
          { title: 'Separate from a card purchase', body: 'A swap spends assets you already hold. A card or bank purchase is the buy screen.' },
          { title: 'You can walk away', body: 'An unsigned quote expires. It is not an order the platform can complete for you.' },
          { title: 'The same three fee lines', body: 'Provider, network, and Correnthian are named on the quote before you sign.' },
        ],
        columnsTitle: 'Who does what',
        columns: [
          { title: 'What the server does', items: ['Prices the quote', 'Assembles the unsigned transaction', 'Refuses a quote it cannot fill'] },
          { title: 'What your device does', items: ['Holds the key', 'Signs the approve and the swap', 'Nothing moves until that signature exists'] },
        ],
        faqs: [
          { question: 'Does asking for a quote buy the gold?', answer: 'No. A quote is a price. Funds move only after you sign.' },
          { question: 'Can Correnthian sign the swap?', answer: 'No. The server prepares the transaction. The key stays on your device.' },
          { question: 'Why would the button be missing?', answer: 'A thin market, or no contracted provider, is shown as a limit. It is not turned into a button.' },
        ],
        related: ['buy', 'gold', 'activity'],
        note: 'Live swaps wait on a liquidity provider. Until one is contracted, the screen does not pretend a quote can be filled.',
      },
      {
        slug: 'portfolio',
        label: 'Portfolio',
        detail: 'What you hold, and who backs it',
        title: 'Portfolio',
        eyebrow: 'Products',
        description: 'The account home: holdings, backing, and a value only when a price is known.',
        lede: 'The account opens on what you hold. Each line names the asset and who backs it. A figure appears only when a price exists.',
        panel: {
          title: 'On each line',
          rows: [
            { label: 'Asset', value: 'Chain, contract, issuer' },
            { label: 'Backing', value: 'Allocated, pooled, or price only' },
            { label: 'Value', value: 'Only when a price exists' },
          ],
        },
        steps: [
          { title: 'Open on holdings', body: 'The first screen is the metal and the other assets in the account.' },
          { title: 'Read the backing', body: 'Allocated metal can name the amount, the custodian, the vault, and the last attestation.' },
          { title: 'Leave gaps as gaps', body: 'An unpriced holding stays out of the total, and the screen counts how many were excluded.' },
        ],
        points: [
          { title: 'Metal is marked as metal', body: 'Gold and silver sit with the rest of the account, and a metal line is marked as metal.' },
          { title: 'Pooled is not reserved', body: 'Aggregate backing means no specific metal is reserved for you.' },
          { title: 'Synthetic is not metal', body: 'A synthetic token is price exposure only. It is not described as gold or silver you can take out.' },
        ],
        columnsTitle: 'What counts in the total',
        columns: [
          { title: 'Shown as a figure', items: ['A holding with a known price', 'A total built only from those prices', 'The share of the account that price represents'] },
          { title: 'Left out of the total', items: ['A holding with no price', 'A count of how many were excluded', 'No guessed cent added to the figure'] },
        ],
        faqs: [
          { question: 'Does the portfolio hold my gold?', answer: 'No. It reads what the account already holds. The gold stays in an account only you can move.' },
          { question: 'What if a price is missing?', answer: 'That holding is excluded from the combined figure, and the screen says so.' },
        ],
        related: ['gold', 'silver', 'activity'],
      },
      {
        slug: 'activity',
        label: 'Activity',
        detail: 'Buys, swaps, and sends for your account',
        title: 'Activity',
        eyebrow: 'Products',
        description: 'Your own buys, swaps, and sends, with amounts taken from the asset registry.',
        lede: 'Activity is the history of your account: buys, swaps, and sends. The list is limited to the signed-in account.',
        panel: {
          title: 'Each row',
          rows: [
            { label: 'Whose', value: 'The signed-in account' },
            { label: 'Amount', value: 'From the asset’s decimals' },
            { label: 'Chain', value: 'A public explorer link, when sent' },
          ],
        },
        steps: [
          { title: 'Your rows only', body: 'The history is read for the signed-in account. One holder does not see another’s transactions.' },
          { title: 'Amounts from the registry', body: 'A token amount uses that asset’s decimals. A missing asset is shown raw, not guessed.' },
          { title: 'Open it on the chain', body: 'When a transaction has been sent, the row can link to the public explorer.' },
        ],
        points: [
          { title: 'Buys, swaps, and sends', body: 'The list is the movement of the account, not a market feed.' },
          { title: 'No invented precision', body: 'If the registry has no decimals for an asset, the raw value is what you see.' },
          { title: 'The chain is the record', body: 'A broadcast transaction can be checked on the public explorer for that chain.' },
        ],
        columnsTitle: 'What the list includes',
        columns: [
          { title: 'On this screen', items: ['Your own history', 'Amounts formatted from the registry', 'A link when a transaction was sent'] },
          { title: 'Not on this screen', items: ['Another holder’s activity', 'A guessed decimal place', 'A trade Correnthian signed for you'] },
        ],
        faqs: [
          { question: 'Can someone else see my activity?', answer: 'The list is scoped to the signed-in account. It is not a public feed of every customer.' },
          { question: 'What if the asset is missing?', answer: 'The row shows the raw value. It does not invent a precision.' },
        ],
        related: ['portfolio', 'swap', 'buy'],
      },
      {
        slug: 'app',
        label: 'Mobile app',
        detail: 'The same account on your phone',
        title: 'Mobile app',
        eyebrow: 'Products',
        description: 'Track gold and silver from your phone. The account stays one only you can move.',
        lede: 'The phone is the same account: portfolio, buy, swap, and activity. Keys stay on the device. The apps are not in the stores yet.',
        panel: {
          title: 'On the phone',
          rows: [
            { label: 'Portfolio', value: 'What you hold' },
            { label: 'Buy and swap', value: 'Two separate screens' },
            { label: 'Stores', value: 'No listing yet' },
          ],
        },
        steps: [
          { title: 'Open on the portfolio', body: 'The phone starts with what you hold, the same way the account does.' },
          { title: 'Buy and swap stay apart', body: 'A card or bank purchase and a swap of assets you already hold are different screens.' },
          { title: 'Ask for access', body: 'There is no live App Store or Play listing. The waitlist is how to ask.' },
        ],
        points: [
          { title: 'The key stays on the phone', body: 'The app does not send a key to Correnthian. The account remains one only you can move.' },
          { title: 'The same fee lines', body: 'A buy or a swap on the phone still shows provider, network, and Correnthian before you commit.' },
          { title: 'Nothing to install yet', body: 'This page does not pretend a download is available.' },
        ],
        columnsTitle: 'The phone, and what it is not',
        columns: [
          { title: 'What the app is', items: ['Portfolio, buy, swap, and activity', 'The same backing on each holding', 'Signing on the device'] },
          { title: 'What it is not yet', items: ['A live store listing', 'A card you can spend', 'A yield paid for holding'] },
        ],
        faqs: [
          { question: 'Where do I download it?', answer: 'You cannot yet. The apps are not in the stores. Join the waitlist to ask for access.' },
          { question: 'Are the store buttons on this site the app?', answer: 'No. Those buttons still point at the template listings. They are not a Correnthian app.' },
        ],
        related: ['portfolio', 'buy', 'swap'],
        note: 'Store buttons elsewhere on this site still point at the template listings. They are not a Correnthian app.',
      },
    ],
  },
  {
    label: 'Assets',
    items: [
      {
        slug: 'gold',
        label: 'Gold',
        detail: 'Shown as gold only when metal is allocated',
        title: 'Gold',
        eyebrow: 'Assets',
        description: 'How Correnthian registers third-party gold tokens, and what it refuses to call gold.',
        lede: 'Correnthian does not mint a gold token and does not run a vault. It registers tokens someone else issued. A token is shown as gold you hold only when specific metal is allocated to it.',
        panel: {
          title: 'What the line can say',
          rows: [
            { label: 'Identity', value: 'Chain, contract, issuer' },
            { label: 'Allocated', value: 'Specific metal per token' },
            { label: 'Otherwise', value: 'Pooled, or price only' },
          ],
        },
        steps: [
          { title: 'Name the token', body: 'Chain, contract, and issuer. The same ticker on another contract is a different asset.' },
          { title: 'Read the backing', body: 'Allocated gold can name grams or troy ounces, the custodian, the vault, and the last attestation.' },
          { title: 'Say what it is not', body: 'Unallocated means no specific metal is reserved. A synthetic token is price exposure only.' },
        ],
        points: [
          { title: 'Examples, not a house coin', body: 'PAXG and XAUT are examples of allocated gold tokens issued by someone else. Listing one still depends on a review of that issuer.' },
          { title: 'Correnthian does not custody the bars', body: 'The vault, if one is named, belongs to the issuer’s arrangement. Correnthian does not insure it.' },
          { title: 'You can ask how to take it out', body: 'Physical delivery is the issuer’s rule, on the redemption page. It is not a shipment from Correnthian.' },
        ],
        columnsTitle: 'When a token is gold you hold',
        columns: [
          { title: 'Shown as gold you hold', items: ['Specific metal allocated to the token', 'An amount per token', 'A custodian, a vault, and an attestation when those exist'] },
          { title: 'Not described as that', items: ['A pool with no bar reserved for you', 'A token that only tracks a gold price', 'A coin minted by Correnthian'] },
        ],
        faqs: [
          { question: 'Does Correnthian issue the gold?', answer: 'No. Correnthian registers third-party tokens. It does not mint a Correnthian gold coin.' },
          { question: 'Is every gold ticker allocated metal?', answer: 'No. Only a token with specific metal allocated to it is shown that way. Pooled and synthetic tokens are labeled as what they are.' },
        ],
        related: ['buy', 'silver', 'redemption'],
        note: 'Correnthian does not custody the bars behind a third-party token, and it does not insure them.',
      },
      {
        slug: 'silver',
        label: 'Silver',
        detail: 'The same registry, shown as metal only when allocated',
        title: 'Silver',
        eyebrow: 'Assets',
        description: 'Silver uses the same registry and the same backing test as gold.',
        lede: 'Silver is the same kind of holding as gold: a third-party token, identified by chain, contract, and issuer. It is shown as silver you hold only when specific metal is allocated.',
        panel: {
          title: 'The same test as gold',
          rows: [
            { label: 'Identity', value: 'Chain, contract, issuer' },
            { label: 'Allocated', value: 'Specific silver per token' },
            { label: 'Otherwise', value: 'Not called silver you hold' },
          ],
        },
        steps: [
          { title: 'Use the gold test', body: 'Allocated silver can name the metal per token, the custodian, and the attestation.' },
          { title: 'Keep the pool a pool', body: 'Unallocated silver is not a bar reserved for you.' },
          { title: 'Keep a price a price', body: 'A synthetic token that tracks silver is price exposure, not metal you can take out.' },
        ],
        points: [
          { title: 'No house silver token', body: 'Correnthian does not mint silver.' },
          { title: 'Nothing listed until the record exists', body: 'A silver token is not presented as allocated metal until the issuer, the vault, and an attestation are on the record.' },
          { title: 'The portfolio marks it as metal', body: 'When it passes that test, it sits in the account as metal, beside gold.' },
        ],
        columnsTitle: 'When a token is silver you hold',
        columns: [
          { title: 'Can be shown as silver', items: ['Specific metal allocated to the token', 'A named issuer', 'A vault and an attestation on the record'] },
          { title: 'Stays unlabeled as that', items: ['A price tracker', 'A pool with no reserved metal', 'A token with no issuer record'] },
        ],
        faqs: [
          { question: 'Is a silver token registered here?', answer: 'No silver token is claimed on this page as registered, allocated, or insured.' },
          { question: 'How is silver different from gold?', answer: 'It is not. The registry and the backing test are the same. The metal is silver only when the record says specific silver is allocated.' },
        ],
        related: ['gold', 'portfolio', 'redemption'],
        note: 'No silver token is claimed here as registered, allocated, or insured.',
      },
    ],
  },
  {
    label: 'Take it out',
    items: [
      {
        slug: 'redemption',
        label: 'Redemption',
        detail: 'Physical delivery is the issuer’s, not ours',
        title: 'Redemption',
        eyebrow: 'Assets',
        description: 'How a request for physical metal is recorded, and who actually delivers it.',
        lede: 'Taking metal out of a token is the issuer’s delivery, not a shipment from Correnthian. A request records the asset, the amount, and the provider.',
        panel: {
          title: 'A request records',
          rows: [
            { label: 'Asset', value: 'The token you hold' },
            { label: 'Amount', value: 'What you ask to redeem' },
            { label: 'Provider', value: 'Who the issuer names' },
          ],
        },
        steps: [
          { title: 'Start from the token', body: 'The request names the asset and the amount. It does not create metal.' },
          { title: 'Use the account’s country', body: 'Jurisdiction is read from the account. The form cannot switch you into another country.' },
          { title: 'The issuer decides', body: 'Minimum size, identity checks, and where a bar can go come from the token’s issuer.' },
        ],
        points: [
          { title: 'Correnthian does not ship it', body: 'The screen can record a request. It cannot send a parcel from a Correnthian vault.' },
          { title: 'A small balance is not a bar', body: 'Issuer minimums apply. A small holding is not a promise of metal at your door.' },
          { title: 'Not an offer', body: 'This page describes the request. It is not an offer to deliver bars.' },
        ],
        columnsTitle: 'Who delivers',
        columns: [
          { title: 'The issuer', items: ['Sets the minimum', 'Runs the identity check they require', 'Delivers, if their terms allow it'] },
          { title: 'Correnthian', items: ['Records the request', 'Does not hold the bars', 'Does not mint, burn, or ship them'] },
        ],
        faqs: [
          { question: 'Will Correnthian mail me gold?', answer: 'No. Physical delivery is the issuer’s. Correnthian does not run a vault and does not ship bars.' },
          { question: 'Can I pick a country where delivery is allowed?', answer: 'No. The request uses the country on the account.' },
        ],
        related: ['gold', 'silver', 'portfolio'],
        note: 'Physical redemption stays subject to the issuer’s terms. This page is not an offer to deliver bars.',
      },
    ],
  },
]

export const productPages: readonly ProductPage[] = productGroups.flatMap((group) => group.items)

export function findProduct(slug: string): ProductPage | undefined {
  return productPages.find((page) => page.slug === slug)
}
