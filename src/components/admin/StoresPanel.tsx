import { useState } from "react";
import { Plus, Trash2, Pencil, X, Store as StoreIcon } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useSaveStore,
  useDeleteStore,
  useStoreMembers,
  useSetStoreMember,
  type StoreDraft,
} from "@/hooks/useStoreLedger";
import { useWorkers } from "@/hooks/useTeam";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Store } from "@/types/db";

const EMPTY: StoreDraft = {
  name: "",
  code: "",
  address: "",
  phone: "",
  active: true,
  nif: "",
  rc: "",
  activity_number: "",
  email: "",
  website: "",
  deposit_min_percent: 20,
  deposit_max_percent: 80,
};

/**
 * Shops, and who works in which. Only the owner can write either — RLS enforces
 * it, this just matches. A worker with the `store` section but no membership
 * sees no shop at all, which is deliberate: fail closed, then assign.
 */
export function StoresPanel({ stores, isOwner }: { stores: Store[]; isOwner: boolean }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const save = useSaveStore();
  const remove = useDeleteStore();
  const { data: members = [] } = useStoreMembers();
  const { data: workers = [] } = useWorkers();
  const setMember = useSetStoreMember();
  const [draft, setDraft] = useState<StoreDraft | null>(null);

  async function submit() {
    if (!draft?.name.trim()) {
      toast.error(t("posStoreNameRequired"));
      return;
    }
    const depositMin = Math.min(Math.max(draft.deposit_min_percent ?? 20, 0), 100);
    const depositMax = Math.min(Math.max(draft.deposit_max_percent ?? 80, 0), 100);
    if (depositMin > depositMax) {
      toast.error(t("posDepositRangeInvalid"));
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        name: draft.name.trim(),
        code: draft.code?.trim() || null,
        nif: draft.nif?.trim() || null,
        rc: draft.rc?.trim() || null,
        activity_number: draft.activity_number?.trim() || null,
        email: draft.email?.trim() || null,
        website: draft.website?.trim() || null,
        deposit_min_percent: depositMin,
        deposit_max_percent: depositMax,
      });
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  // Shops are ON DELETE RESTRICT from sales/returns/transfers on purpose —
  // deleting a shop must never silently orphan its history. Say so instead of
  // letting the click do nothing.
  async function drop(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(t("adminSaved"));
    } catch {
      toast.error(t("posStoreDeleteBlocked"));
    }
  }

  const isMember = (storeId: string, userId: string) =>
    members.some((m) => m.store_id === storeId && m.user_id === userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("posStores")}</h3>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={14} /> {t("add")}
          </Button>
        )}
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("posStoreName")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              placeholder={t("posStoreCode")}
              value={draft.code ?? ""}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <Input
              placeholder={t("finAddress")}
              value={draft.address ?? ""}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("finPhone")}
              value={draft.phone ?? ""}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("posStoreEmail")}
              value={draft.email ?? ""}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("posStoreWebsite")}
              value={draft.website ?? ""}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("posStoreNif")}
              value={draft.nif ?? ""}
              onChange={(e) => setDraft({ ...draft, nif: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("posStoreRc")}
              value={draft.rc ?? ""}
              onChange={(e) => setDraft({ ...draft, rc: e.target.value })}
            />
            <Input
              dir="ltr"
              placeholder={t("posStoreActivity")}
              value={draft.activity_number ?? ""}
              onChange={(e) => setDraft({ ...draft, activity_number: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted">{t("posStoreIdentityHint")}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">{t("posDepositMinPercent")}</span>
              <Input
                type="number"
                min={0}
                max={100}
                dir="ltr"
                value={draft.deposit_min_percent ?? 20}
                onChange={(e) => setDraft({ ...draft, deposit_min_percent: Number(e.target.value) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">{t("posDepositMaxPercent")}</span>
              <Input
                type="number"
                min={0}
                max={100}
                dir="ltr"
                value={draft.deposit_max_percent ?? 80}
                onChange={(e) => setDraft({ ...draft, deposit_max_percent: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="text-xs text-muted">{t("posDepositRangeExplain")}</p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={draft.active ?? true}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            {t("posActive")}
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={save.isPending} onClick={submit}>
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X size={14} /> {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {stores.length === 0 && (
        <p className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-muted">
          {t("posNoStores")}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {stores.map((store) => (
          <div key={store.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-display text-lg text-ink">
                  <StoreIcon size={16} className="text-brand" />
                  {store.name}
                  {!store.active && (
                    <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[0.6rem] uppercase text-muted">
                      {t("pixelPaused")}
                    </span>
                  )}
                </p>
                {store.address && <p className="text-xs text-muted">{store.address}</p>}
                {store.phone && (
                  <p dir="ltr" className="text-xs text-muted">
                    {store.phone}
                  </p>
                )}
              </div>
              {isOwner && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...store })}
                    aria-label={t("edit")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => drop(store.id)}
                    aria-label={t("delete")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-[0.65rem] uppercase tracking-wide2 text-muted">
                  {t("posStoreStaff")}
                </p>
                {workers.length === 0 ? (
                  <p className="text-xs text-muted">{t("posNoStaff")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {workers.map((worker) => (
                      <label
                        key={worker.user_id}
                        className="flex items-center gap-2 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={isMember(store.id, worker.user_id)}
                          onChange={(e) =>
                            setMember.mutate({
                              store_id: store.id,
                              user_id: worker.user_id,
                              member: e.target.checked,
                            })
                          }
                        />
                        <span dir="ltr" className="truncate">
                          {worker.email ?? worker.user_id}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
