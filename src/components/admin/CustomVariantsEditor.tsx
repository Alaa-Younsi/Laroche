import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { ChipListEditor } from "@/components/admin/ChipListEditor";
import type { VariantGroup } from "@/types/db";

export function CustomVariantsEditor({
  groups,
  onChange,
}: {
  groups: VariantGroup[];
  onChange: (next: VariantGroup[]) => void;
}) {
  function updateGroup(index: number, patch: Partial<VariantGroup>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function addGroup() {
    onChange([...groups, { name_fr: "", name_ar: "", values: [] }]);
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {groups.map((group, i) => (
        <div key={i} className="rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center gap-3">
            <Input
              placeholder="Nom (FR) — ex: Matériau"
              value={group.name_fr}
              onChange={(e) => updateGroup(i, { name_fr: e.target.value })}
            />
            <Input
              placeholder="الاسم (AR)"
              dir="rtl"
              value={group.name_ar}
              onChange={(e) => updateGroup(i, { name_ar: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeGroup(i)}
              className="shrink-0 text-muted hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <ChipListEditor
            values={group.values}
            onChange={(values) => updateGroup(i, { values })}
            placeholder="Ajouter une valeur…"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-2 text-sm text-brand hover:brightness-110"
      >
        <Plus size={14} /> Ajouter un groupe de variantes
      </button>
    </div>
  );
}
