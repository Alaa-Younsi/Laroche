import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import type { QuantityOffer } from "@/types/db";

export function OffersEditor({
  offers,
  onChange,
}: {
  offers: QuantityOffer[];
  onChange: (next: QuantityOffer[]) => void;
}) {
  function update(index: number, next: QuantityOffer) {
    onChange(offers.map((o, i) => (i === index ? next : o)));
  }

  function remove(index: number) {
    onChange(offers.filter((_, i) => i !== index));
  }

  function addFree() {
    onChange([...offers, { type: "free", buy: 2, get: 1 }]);
  }

  function addPrice() {
    onChange([...offers, { type: "price", qty: 2, price: 0 }]);
  }

  return (
    <div className="space-y-3">
      {offers.map((offer, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-3">
          <Select
            value={offer.type}
            onChange={(e) => {
              const type = e.target.value as QuantityOffer["type"];
              update(i, type === "free" ? { type: "free", buy: 2, get: 1 } : { type: "price", qty: 2, price: 0 });
            }}
            className="w-40"
          >
            <option value="free">Achetez X obtenez Y</option>
            <option value="price">X pour un prix fixe</option>
          </Select>

          {offer.type === "free" ? (
            <>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={offer.buy}
                onChange={(e) => update(i, { ...offer, buy: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">+</span>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={offer.get}
                onChange={(e) => update(i, { ...offer, get: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">offert(s)</span>
            </>
          ) : (
            <>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={offer.qty}
                onChange={(e) => update(i, { ...offer, qty: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">pour</span>
              <Input
                type="number"
                min={0}
                className="w-28"
                value={offer.price}
                onChange={(e) => update(i, { ...offer, price: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">DA</span>
            </>
          )}

          <button
            type="button"
            onClick={() => remove(i)}
            className="ms-auto shrink-0 text-muted hover:text-red-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <div className="flex gap-4">
        <button type="button" onClick={addFree} className="flex items-center gap-2 text-sm text-brand hover:brightness-110">
          <Plus size={14} /> Offre "achetez, obtenez"
        </button>
        <button type="button" onClick={addPrice} className="flex items-center gap-2 text-sm text-brand hover:brightness-110">
          <Plus size={14} /> Offre lot à prix fixe
        </button>
      </div>
    </div>
  );
}
