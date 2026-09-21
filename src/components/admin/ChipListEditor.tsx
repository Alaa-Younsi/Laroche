import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/i18n/LanguageProvider";

export function ChipListEditor({
  values,
  onChange,
  placeholder,
  dir,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  dir?: "rtl" | "ltr";
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value && !values.includes(value)) {
      onChange([...values, value]);
    }
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1.5 rounded-full bg-panel-2 px-3 py-1.5 text-xs text-ink"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`${t("adminChipRemove")} ${value}`}
              className="text-muted hover:text-red-500"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          dir={dir}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={commit}
          aria-label={t("adminChipAdd")}
          className="shrink-0 rounded-lg border border-line px-3 text-ink hover:border-brand hover:text-brand"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
