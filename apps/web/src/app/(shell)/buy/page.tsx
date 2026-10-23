import { BuyFiat, BuySwap } from "@/components/buy-swap"

export default function BuyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Buy</h1>
      <BuyFiat />
      <BuySwap />
    </div>
  )
}
