import type { QuantityOffer } from "@/types/db";

function candidateTotal(offer: QuantityOffer, price: number, qty: number): number {
  if (offer.type === "free") {
    const group = offer.buy + offer.get;
    if (group <= 0 || offer.buy <= 0) return price * qty;
    const groups = Math.floor(qty / group);
    const remainder = qty % group;
    const paidInGroups = groups * offer.buy;
    const paidRemainder = Math.min(remainder, offer.buy);
    return (paidInGroups + paidRemainder) * price;
  }

  if (offer.type === "price") {
    if (offer.qty <= 0 || offer.price < 0) return price * qty;
    const bundles = Math.floor(qty / offer.qty);
    const remainder = qty % offer.qty;
    return bundles * offer.price + remainder * price;
  }

  return price * qty;
}

export function lineTotal(
  price: number,
  qty: number,
  offers: QuantityOffer[] | undefined,
): number {
  const base = price * qty;
  if (!offers || offers.length === 0) return base;

  let best = base;
  for (const offer of offers) {
    const total = candidateTotal(offer, price, qty);
    if (total < best) best = total;
  }
  return Math.max(0, best);
}

export function lineDiscount(
  price: number,
  qty: number,
  offers: QuantityOffer[] | undefined,
): number {
  return price * qty - lineTotal(price, qty, offers);
}
