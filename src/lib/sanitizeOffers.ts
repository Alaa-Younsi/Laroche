import type { QuantityOffer } from "@/types/db";

export function sanitizeOffers(offers: QuantityOffer[]): QuantityOffer[] {
  return offers.filter((offer) => {
    if (offer.type === "free") {
      return Number.isFinite(offer.buy) && offer.buy > 0 && Number.isFinite(offer.get) && offer.get > 0;
    }
    if (offer.type === "price") {
      return Number.isFinite(offer.qty) && offer.qty > 0 && Number.isFinite(offer.price) && offer.price >= 0;
    }
    return false;
  });
}
