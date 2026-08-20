"use client";

import { PlusIcon, TrophyIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  api,
  type ScreenRatio,
  type SpinAnalytics,
  type SpinCampaign,
  type SpinDurationMs,
  type SpinPrize,
  type SpinWinner,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatKeybinding, SPIN_KEY_PRESETS } from "@/lib/keybinding";

type ManageTab = "display" | "campaigns" | "prizes" | "winners" | "analytics";

const SPIN_DURATION_OPTIONS: SpinDurationMs[] = [3000, 5000, 7000];

export function SpinDashboardClient() {
  const { token } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [screenRatio, setScreenRatio] = useState<ScreenRatio>("auto");
  const [spinKeybinding, setSpinKeybinding] = useState("");
  const [spinDurationMs, setSpinDurationMs] = useState<SpinDurationMs>(5000);
  const [capturingKey, setCapturingKey] = useState(false);
  const [campaigns, setCampaigns] = useState<SpinCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [prizes, setPrizes] = useState<SpinPrize[]>([]);
  const [probabilityTotal, setProbabilityTotal] = useState(0);
  const [winners, setWinners] = useState<SpinWinner[]>([]);
  const [winnersTotal, setWinnersTotal] = useState(0);
  const [analytics, setAnalytics] = useState<SpinAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("display");
  const [campaignName, setCampaignName] = useState("");
  const [voucherSearch, setVoucherSearch] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<SpinPrize | null>(null);
  const [prizeItemName, setPrizeItemName] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState("");
  const [prizeProbability, setPrizeProbability] = useState("");
  const [prizeImage, setPrizeImage] = useState<File | null>(null);
  const [prizeImagePreview, setPrizeImagePreview] = useState<string | null>(null);
  const [prizeModalError, setPrizeModalError] = useState<string | null>(null);
  const [savingPrize, setSavingPrize] = useState(false);
  const prizeImagePreviewRef = useRef<string | null>(null);
  const savingPrizeRef = useRef(false);

  useEffect(() => {
    savingPrizeRef.current = savingPrize;
  }, [savingPrize]);

  useEffect(() => {
    return () => {
      if (prizeImagePreviewRef.current) {
        URL.revokeObjectURL(prizeImagePreviewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!prizeModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingPrizeRef.current) closePrizeModal();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [prizeModalOpen]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;
  const oddsMode = selectedCampaign?.odds_mode === "manual" ? "manual" : "auto";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [settings, campaignRes, stats] = await Promise.all([
        api.getSpinSettings(token),
        api.listCampaigns(token),
        api.getAnalytics(token),
      ]);
      setEnabled(settings.enabled);
      setScreenRatio(settings.screen_ratio ?? "auto");
      setSpinKeybinding(settings.spin_keybinding ?? "Space");
      setSpinDurationMs(
        settings.spin_duration_ms === 3000 ||
          settings.spin_duration_ms === 5000 ||
          settings.spin_duration_ms === 7000
          ? settings.spin_duration_ms
          : 5000,
      );
      setCampaigns(campaignRes.items);
      setAnalytics(stats);
      setSelectedCampaignId((current) => current || campaignRes.items[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPrizes = useCallback(async () => {
    if (!token || !selectedCampaignId) return;
    try {
      const res = await api.listPrizes(token, selectedCampaignId);
      setPrizes(res.items);
      setProbabilityTotal(res.probability_total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prizes");
    }
  }, [token, selectedCampaignId]);

  useEffect(() => {
    if (manageTab === "prizes" || manageTab === "campaigns") void loadPrizes();
  }, [manageTab, loadPrizes]);

  useEffect(() => {
    if (!token || manageTab !== "winners") return;
    void api
      .listWinners(token, voucherSearch || undefined)
      .then((res) => {
        setWinners(res.items);
        setWinnersTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load winners"));
  }, [token, manageTab, voucherSearch]);

  async function toggleEnabled(next: boolean) {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.updateSpinSettings(token, { enabled: next });
      setEnabled(res.enabled);
      setMessage(next ? "Spin wheel enabled on the public site." : "Spin wheel hidden from public site.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update display setting");
    } finally {
      setBusy(false);
    }
  }

  const setSpinKeybindingSetting = useCallback(
    async (next: string) => {
      if (!token) return;
      setCapturingKey(false);
      if (next === spinKeybinding) return;

      const previous = spinKeybinding;
      setSpinKeybinding(next);
      setBusy(true);
      setMessage(null);
      setError(null);
      try {
        const res = await api.updateSpinSettings(token, { spin_keybinding: next });
        setSpinKeybinding(res.spin_keybinding);
        setMessage(
          res.spin_keybinding
            ? `Spin keybinding set to ${formatKeybinding(res.spin_keybinding)}.`
            : "Keyboard spin trigger disabled.",
        );
      } catch (err) {
        setSpinKeybinding(previous);
        setError(err instanceof Error ? err.message : "Failed to update keybinding");
      } finally {
        setBusy(false);
      }
    },
    [token, spinKeybinding],
  );

  useEffect(() => {
    if (!capturingKey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCapturingKey(false);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();
      void setSpinKeybindingSetting(event.code);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturingKey, setSpinKeybindingSetting]);

  async function setScreenRatioSetting(next: ScreenRatio) {
    if (!token || next === screenRatio) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.updateSpinSettings(token, { screen_ratio: next });
      setScreenRatio(res.screen_ratio);
      setMessage(`Screen ratio set to ${res.screen_ratio}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update screen ratio");
    } finally {
      setBusy(false);
    }
  }

  async function setSpinDurationSetting(next: SpinDurationMs) {
    if (!token || next === spinDurationMs) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.updateSpinSettings(token, { spin_duration_ms: next });
      setSpinDurationMs(res.spin_duration_ms);
      setMessage(`Spin duration set to ${res.spin_duration_ms / 1000}s.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update spin duration");
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign() {
    if (!token || !campaignName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createCampaign(token, {
        name: campaignName.trim(),
        status: "draft",
        one_per_user: true,
      });
      setCampaignName("");
      setCampaigns((prev) => [created, ...prev]);
      setSelectedCampaignId(created.id);
      setMessage("Campaign created as draft. Add prizes, then activate.");
      setManageTab("prizes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setBusy(false);
    }
  }

  async function setCampaignStatus(campaignId: string, nextStatus: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateCampaign(token, campaignId, { status: nextStatus });
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setMessage(`Campaign marked ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    } finally {
      setBusy(false);
    }
  }

  async function setCampaignOddsMode(campaignId: string, nextMode: "auto" | "manual") {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateCampaign(token, campaignId, { odds_mode: nextMode });
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (campaignId === selectedCampaignId) await loadPrizes();
      setMessage(
        nextMode === "auto"
          ? "Odds mode: Auto — win chances follow quantity."
          : "Odds mode: Manual — set each prize percentage (must total 100%).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update odds mode");
    } finally {
      setBusy(false);
    }
  }

  async function savePrizeProbability(prizeId: string, raw: string) {
    if (!token || !selectedCampaignId || oddsMode !== "manual") return;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      setError("Probability must be between 0 and 100");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updatePrize(token, selectedCampaignId, prizeId, { probability: value });
      await loadPrizes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update probability");
    } finally {
      setBusy(false);
    }
  }

  function resetPrizeModalFields() {
    if (prizeImagePreviewRef.current) {
      URL.revokeObjectURL(prizeImagePreviewRef.current);
      prizeImagePreviewRef.current = null;
    }
    setEditingPrize(null);
    setPrizeItemName("");
    setPrizeQuantity("");
    setPrizeProbability("");
    setPrizeImage(null);
    setPrizeImagePreview(null);
    setPrizeModalError(null);
  }

  function openPrizeModal() {
    resetPrizeModalFields();
    setPrizeModalOpen(true);
  }

  function openEditPrizeModal(prize: SpinPrize) {
    resetPrizeModalFields();
    setEditingPrize(prize);
    setPrizeItemName(prize.name);
    setPrizeQuantity(String(prize.stock));
    setPrizeProbability(String(prize.probability));
    setPrizeImagePreview(prize.image_url || null);
    setPrizeModalOpen(true);
  }

  function closePrizeModal() {
    if (savingPrize) return;
    setPrizeModalOpen(false);
    resetPrizeModalFields();
  }

  function setPrizeImageFile(file: File | null) {
    if (prizeImagePreviewRef.current) {
      URL.revokeObjectURL(prizeImagePreviewRef.current);
      prizeImagePreviewRef.current = null;
    }
    if (!file) {
      setPrizeImage(null);
      setPrizeImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPrizeModalError("Image must be PNG, JPG, or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPrizeModalError("Image must be 5 MB or smaller.");
      return;
    }
    const preview = URL.createObjectURL(file);
    prizeImagePreviewRef.current = preview;
    setPrizeModalError(null);
    setPrizeImage(file);
    setPrizeImagePreview(preview);
  }

  async function submitPrizeModal() {
    if (!token || !selectedCampaignId) return;
    const name = prizeItemName.trim();
    const quantity = Number(prizeQuantity);
    if (!name) {
      setPrizeModalError("Item name is required.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setPrizeModalError("Quantity must be a whole number of at least 1.");
      return;
    }
    let probability: number | undefined;
    if (oddsMode === "manual") {
      probability = Number(prizeProbability);
      if (Number.isNaN(probability) || probability < 0 || probability > 100) {
        setPrizeModalError("Win probability must be between 0 and 100.");
        return;
      }
    }
    if (!editingPrize && !prizeImage) {
      setPrizeModalError("Image is required.");
      return;
    }

    setSavingPrize(true);
    setPrizeModalError(null);
    try {
      if (editingPrize) {
        await api.updatePrize(token, selectedCampaignId, editingPrize.id, {
          name,
          stock: quantity,
          ...(probability === undefined ? {} : { probability }),
        });
        if (prizeImage) {
          await api.uploadPrizeImage(token, selectedCampaignId, editingPrize.id, prizeImage);
        }
        setPrizeModalOpen(false);
        resetPrizeModalFields();
        await loadPrizes();
        setMessage("Prize updated.");
      } else {
        const created = await api.createPrize(token, selectedCampaignId, {
          name,
          stock: quantity,
          ...(probability === undefined ? {} : { probability }),
          enabled: true,
        });
        await api.uploadPrizeImage(token, selectedCampaignId, created.id, prizeImage!);
        setPrizeModalOpen(false);
        resetPrizeModalFields();
        await loadPrizes();
        setMessage("Prize added.");
      }
    } catch (err) {
      setPrizeModalError(
        err instanceof Error
          ? err.message
          : editingPrize
            ? "Failed to update prize"
            : "Failed to add prize",
      );
    } finally {
      setSavingPrize(false);
    }
  }

  async function onPrizeImage(prizeId: string, file: File | null) {
    if (!token || !selectedCampaignId || !file) return;
    setBusy(true);
    try {
      await api.uploadPrizeImage(token, selectedCampaignId, prizeId, file);
      await loadPrizes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!token || !redeemCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.redeemVoucher(token, redeemCode.trim());
      setMessage(`Redeemed ${result.voucher_code}`);
      setRedeemCode("");
      const res = await api.listWinners(token);
      setWinners(res.items);
      setWinnersTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      setBusy(false);
    }
  }

  const manageTabs: Array<{ id: ManageTab; label: string }> = [
    { id: "display", label: "Display" },
    { id: "campaigns", label: "Campaigns" },
    { id: "prizes", label: "Prizes" },
    { id: "winners", label: "Winners" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-3xl space-y-10 pb-12">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        {loading ? (
          <div className="flex gap-4">
            <div className="size-[88px] shrink-0 animate-pulse rounded-[22px] bg-slate-100" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-7 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ) : (
          <header className="flex items-start gap-4 sm:gap-5">
            <div className="flex size-[88px] shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm sm:size-[104px] sm:rounded-[26px]">
              <TrophyIcon className="size-10 text-white sm:size-12" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                Lucky Spin
              </h1>
              <p className="mt-0.5 text-sm text-orange-600 sm:text-[15px]">Raffle Dashboard</p>
              <p className="mt-2 text-sm text-slate-500">
                Manage campaigns, prizes, winners, and analytics.
              </p>
            </div>
          </header>
        )}

        {!loading ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Configuration</h2>
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {manageTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setManageTab(item.id)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    manageTab === item.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {manageTab === "display" ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-sm text-slate-500">
                  When enabled, the spin wheel appears on the public raffle page.
                </p>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <label htmlFor="spin-enabled" className="text-sm font-medium text-slate-800">
                    Enable spin wheel on public site
                  </label>
                  <Switch
                    id="spin-enabled"
                    checked={enabled}
                    disabled={busy}
                    onCheckedChange={(checked) => void toggleEnabled(checked)}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Screen ratio</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      How the public spin page is framed — portrait kiosk, landscape display, or full
                      screen.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200/80 p-1">
                    {(["auto", "9:16", "16:9"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        disabled={busy}
                        onClick={() => void setScreenRatioSetting(ratio)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          screenRatio === ratio
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {ratio === "auto" ? "Auto" : ratio}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center rounded-xl bg-slate-200/60 p-4">
                    <div
                      className={cn(
                        "spin-page-bg flex items-center justify-center overflow-hidden rounded-lg border border-white/60 shadow-md",
                        screenRatio === "9:16" && "aspect-[9/16] h-40 w-auto",
                        screenRatio === "16:9" && "aspect-video w-full max-w-xs",
                        screenRatio === "auto" && "h-24 w-full max-w-xs",
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider text-sky-800/70">
                        Preview
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Spin duration</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      How long the public wheel spins before stopping on a prize.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200/80 p-1">
                    {SPIN_DURATION_OPTIONS.map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        disabled={busy}
                        onClick={() => void setSpinDurationSetting(duration)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          spinDurationMs === duration
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {duration / 1000}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Spin keybinding</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Press this key on the public spin page to trigger the spin button (kiosk /
                      display use).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200/80 p-1">
                    {SPIN_KEY_PRESETS.map((preset) => (
                      <button
                        key={preset.code || "none"}
                        type="button"
                        disabled={busy}
                        onClick={() => void setSpinKeybindingSetting(preset.code)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          spinKeybinding === preset.code
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={capturingKey ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => setCapturingKey((active) => !active)}
                    >
                      {capturingKey ? "Cancel · press a key…" : "Record custom key"}
                    </Button>
                    <span className="text-xs text-slate-500">
                      Current:{" "}
                      <span className="font-medium text-slate-800">
                        {formatKeybinding(spinKeybinding)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {manageTab === "campaigns" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <input
                    className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Campaign name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                  <Button disabled={busy || !campaignName.trim()} onClick={() => void createCampaign()}>
                    Create campaign
                  </Button>
                </div>
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-2xl border bg-white p-4",
                        selectedCampaignId === c.id ? "border-orange-300" : "border-slate-200",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            className="font-medium hover:underline"
                            onClick={() => setSelectedCampaignId(c.id)}
                          >
                            {c.name}
                          </button>
                          <p className="text-xs text-slate-500">
                            Status: {c.status} · one per user: {c.one_per_user ? "yes" : "no"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {c.status !== "active" ? (
                            <Button size="sm" disabled={busy} onClick={() => void setCampaignStatus(c.id, "active")}>
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void setCampaignStatus(c.id, "ended")}
                            >
                              End
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCampaignId(c.id);
                              setManageTab("prizes");
                            }}
                          >
                            Prizes
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Win odds</p>
                          <p className="text-xs text-slate-500">
                            {(c.odds_mode ?? "auto") === "manual"
                              ? "Manual percentages (must total 100%)"
                              : "Auto from quantity"}
                          </p>
                        </div>
                        <div className="flex rounded-lg bg-slate-100 p-0.5">
                          {(["auto", "manual"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              disabled={busy}
                              onClick={() => void setCampaignOddsMode(c.id, mode)}
                              className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                                (c.odds_mode ?? "auto") === mode
                                  ? "bg-white text-slate-900 shadow-sm"
                                  : "text-slate-600 hover:text-slate-900",
                              )}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {campaigns.length === 0 ? (
                    <p className="text-sm text-slate-500">No campaigns yet.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {manageTab === "prizes" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-slate-500">Campaign</label>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCampaignId ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Wheel prizes</p>
                        <p className="text-xs text-slate-500">
                          {oddsMode === "manual"
                            ? "Set name, quantity, image, and win % (must total 100%)."
                            : "Add items with name, quantity, and image. Odds follow quantity."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {prizes.length > 0 ? (
                          <p
                            className={cn(
                              "text-xs font-medium",
                              Math.abs(probabilityTotal - 100) > 0.01
                                ? "text-amber-600"
                                : "text-emerald-600",
                            )}
                          >
                            Total odds {probabilityTotal.toFixed(2)}%
                          </p>
                        ) : null}
                        <Button type="button" disabled={busy} onClick={openPrizeModal}>
                          <PlusIcon className="size-4" />
                          Add prize
                        </Button>
                      </div>
                    </div>
                    {prizes.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-slate-500">
                        No prizes yet. Click Add prize to create one.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {prizes.map((p) => (
                          <li
                            key={p.id}
                            className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[56px_minmax(0,1fr)_72px_88px_auto]"
                          >
                            <label className="relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-slate-100">
                              {p.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[10px] text-slate-400">
                                  Image
                                </span>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={busy}
                                onChange={(e) => void onPrizeImage(p.id, e.target.files?.[0] ?? null)}
                              />
                            </label>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-500 sm:hidden">
                                Qty {p.stock}
                                {oddsMode === "auto" ? ` · ${p.probability}%` : ""}
                              </p>
                            </div>
                            <p className="hidden text-sm text-slate-700 sm:block">{p.stock}</p>
                            {oddsMode === "manual" ? (
                              <div className="hidden items-center gap-1 sm:flex">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.01}
                                  defaultValue={p.probability}
                                  key={`${p.id}-${p.probability}`}
                                  disabled={busy}
                                  onBlur={(e) => void savePrizeProbability(p.id, e.target.value)}
                                  className="h-8 w-16 rounded-md border border-slate-200 px-2 text-sm"
                                />
                                <span className="text-xs text-slate-500">%</span>
                              </div>
                            ) : (
                              <p className="hidden text-sm text-slate-700 sm:block">{p.probability}%</p>
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => openEditPrizeModal(p)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void (async () => {
                                    if (!token) return;
                                    setBusy(true);
                                    try {
                                      await api.deletePrize(token, selectedCampaignId, p.id);
                                      await loadPrizes();
                                      setMessage("Prize deleted.");
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Failed to delete prize");
                                    } finally {
                                      setBusy(false);
                                    }
                                  })()
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select or create a campaign first.</p>
                )}
              </div>
            ) : null}

            {manageTab === "winners" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Total winners <span className="tabular-nums text-slate-600">{winnersTotal}</span>
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
                    <input
                      className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Search voucher / phone"
                      value={voucherSearch}
                      onChange={(e) => setVoucherSearch(e.target.value)}
                    />
                    <input
                      className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Redeem voucher code"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value)}
                    />
                    <Button disabled={busy || !redeemCode.trim()} onClick={() => void redeem()}>
                      Mark redeemed
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Voucher</th>
                        <th className="px-3 py-2">Prize</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winners.map((w) => (
                        <tr key={w.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs">{w.voucher_code}</td>
                          <td className="px-3 py-2">{w.prize_name}</td>
                          <td className="px-3 py-2">
                            {w.customer_name || "—"}
                            <div className="text-xs text-slate-500">{w.customer_identifier}</div>
                          </td>
                          <td className="px-3 py-2">{w.status}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {new Date(w.won_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {winners.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No winners yet.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {manageTab === "analytics" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Total spins", analytics?.total_spins ?? 0],
                  ["Unique users", analytics?.unique_users ?? 0],
                  ["Redeemed", analytics?.redeemed_count ?? 0],
                  ["Redemption rate", `${analytics?.redemption_rate ?? 0}%`],
                  ["Remaining stock", analytics?.remaining_stock ?? 0],
                  ["Top prize", analytics?.top_prize ?? "—"],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {prizeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closePrizeModal}
            aria-label="Close dialog"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingPrize ? "Edit prize" : "Add prize"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Item shown on the spin wheel.</p>
              </div>
              <button
                type="button"
                onClick={closePrizeModal}
                aria-label="Close"
                disabled={savingPrize}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label htmlFor="prize-item-name" className="block text-sm font-medium text-slate-700">
                  Item name
                </label>
                <input
                  id="prize-item-name"
                  value={prizeItemName}
                  onChange={(e) => setPrizeItemName(e.target.value)}
                  disabled={savingPrize}
                  placeholder="e.g. tumbler"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prize-quantity" className="block text-sm font-medium text-slate-700">
                  Quantity
                </label>
                <input
                  id="prize-quantity"
                  type="number"
                  min={1}
                  value={prizeQuantity}
                  onChange={(e) => setPrizeQuantity(e.target.value)}
                  disabled={savingPrize}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm"
                />
              </div>
              {oddsMode === "manual" ? (
                <div>
                  <label htmlFor="prize-probability" className="block text-sm font-medium text-slate-700">
                    Win probability (%)
                  </label>
                  <input
                    id="prize-probability"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={prizeProbability}
                    onChange={(e) => setPrizeProbability(e.target.value)}
                    disabled={savingPrize}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm"
                  />
                </div>
              ) : null}
              <div>
                <p className="block text-sm font-medium text-slate-700">Image</p>
                <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                  {prizeImagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={prizeImagePreview} alt="" className="mb-3 h-28 w-28 rounded-lg object-cover" />
                  ) : null}
                  <span className="text-sm font-medium text-slate-700">
                    {prizeImage
                      ? prizeImage.name
                      : editingPrize
                        ? "Replace image (optional)"
                        : "Choose image"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={savingPrize}
                    onChange={(e) => setPrizeImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {prizeModalError ? (
                <p className="text-sm text-red-600" role="alert">
                  {prizeModalError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button type="button" variant="outline" disabled={savingPrize} onClick={closePrizeModal}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  savingPrize ||
                  !prizeItemName.trim() ||
                  !prizeQuantity.trim() ||
                  (!editingPrize && !prizeImage) ||
                  (oddsMode === "manual" && !prizeProbability.trim())
                }
                onClick={() => void submitPrizeModal()}
              >
                {savingPrize ? "Saving…" : editingPrize ? "Save changes" : "Add prize"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
