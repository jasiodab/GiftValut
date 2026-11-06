import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  Image as ImageIcon,
  Info,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { api, downloadBackup, downloadNamedBackup } from "@/lib/api";
import { useSettings } from "@/lib/queries";
import { invalidateVaultData } from "@/lib/invalidate";
import { CURRENCIES, TRACKING_INTERVALS } from "@/lib/constants";
import { formatBytes, formatDateTime, timeAgo } from "@/lib/format";
import { parsePriceString } from "@/lib/parse";
import type { BackupFile } from "@/lib/types";

export function SettingsPage() {
  const { data, isLoading, isError, refetch } = useSettings();
  const queryClient = useQueryClient();
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [currency, setCurrency] = useState("PLN");
  const [defaultView, setDefaultView] = useState<"grid" | "list">("grid");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [autoTracking, setAutoTracking] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(360);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState("");

  useEffect(() => {
    if (!data) return;
    setCurrency(data.settings.currency);
    setDefaultView(data.settings.defaultProductView);
    setBudgetDraft(data.settings.budget !== null ? String(data.settings.budget) : "");
    setAutoTracking(data.settings.autoTrackingEnabled);
    setIntervalMinutes(data.settings.priceUpdateIntervalMinutes);
  }, [data?.settings.id, data?.settings.currency, data?.settings.defaultProductView, data?.settings.budget, data?.settings.autoTrackingEnabled, data?.settings.priceUpdateIntervalMinutes]);

  const preferencesMutation = useMutation({
    mutationFn: (body: { currency: string; defaultProductView: "grid" | "list"; budget: number | null }) =>
      api.updateSettings(body),
    onSuccess: async () => {
      toast.success("Preferences saved");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const trackingMutation = useMutation({
    mutationFn: (body: { autoTrackingEnabled: boolean; priceUpdateIntervalMinutes: number }) =>
      api.updateSettings(body),
    onSuccess: async () => {
      toast.success("Tracking settings saved");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      setDownloadingBackup(true);
      return downloadBackup();
    },
    onSuccess: async ({ blob, filename }) => {
      triggerDownload(blob, filename);
      toast.success("Backup created and downloaded");
      await invalidateVaultData(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setDownloadingBackup(false)
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => api.restoreBackup(file),
    onSuccess: async (result) => {
      toast.success("Backup restored", {
        description: `Safety backup kept as ${result.safetyBackup}.`
      });
      setRestoreFile(null);
      setRestoreOpen(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      await invalidateVaultData(queryClient);
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error("Restore failed", { description: error.message })
  });

  const invitationMutation = useMutation({
    mutationFn: () => api.createInvitation(),
    onSuccess: ({ invitation }) => {
      setInvitationLink(`${window.location.origin}${invitation.link}`);
      toast.success("Invitation link created");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const savePreferences = () => {
    let budget: number | null = null;
    if (budgetDraft.trim()) {
      const parsed = parsePriceString(budgetDraft);
      if (parsed === null || parsed < 0) {
        toast.error("Enter a valid budget amount.");
        return;
      }
      budget = parsed;
    }
    preferencesMutation.mutate({ currency, defaultProductView: defaultView, budget });
  };

  const downloadExisting = async (backup: BackupFile) => {
    setDownloadingFile(backup.filename);
    try {
      const blob = await downloadNamedBackup(backup.filename);
      triggerDownload(blob, backup.filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The backup could not be downloaded.");
    } finally {
      setDownloadingFile(null);
    }
  };

  const settings = data?.settings;
  const database = data?.database;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vault"
        title="Settings"
        description="Everything lives on this device. Adjust how Gift Vault behaves, review local storage, and keep portable backups."
        actions={
          <Button asChild>
            <a href="/api/health" target="_blank" rel="noreferrer">
              <ShieldCheck className="h-4 w-4" /> Check local server
            </a>
          </Button>
        }
      />

      {isLoading ? <SettingsSkeleton /> : null}

      {isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Settings could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check that the local server and database are running.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      {data && settings ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <Card>
              <SettingsHeading
                icon={Settings2}
                title="Preferences"
                description="Currency, default view and the budget used across the vault."
              />
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Display currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Used for new products and summaries.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Default product view</Label>
                    <Select
                      value={defaultView}
                      onValueChange={(value) => setDefaultView(value as "grid" | "list")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">A saved view choice overrides this.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-budget">Season budget ({currency})</Label>
                  <Input
                    id="settings-budget"
                    inputMode="decimal"
                    value={budgetDraft}
                    onChange={(event) => setBudgetDraft(event.target.value)}
                    placeholder="Leave empty for no budget"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Also editable from the Budget page. Grouped offers count once.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={savePreferences} loading={preferencesMutation.isPending}>
                    <Save className="h-4 w-4" /> Save preferences
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <SettingsHeading
                icon={RefreshCw}
                title="Price tracking"
                description="Control automatic checks and how often they run."
              />
              <div className="space-y-5 p-5">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-card px-4 py-3">
                  <div>
                    <p className="text-xs font-medium">Automatic price tracking</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      The scheduler checks due products in small batches. Failed checks never overwrite a valid price.
                    </p>
                  </div>
                  <Switch checked={autoTracking} onCheckedChange={setAutoTracking} />
                </div>
                <div className="space-y-1.5">
                  <Label>Check interval</Label>
                  <Select
                    value={String(intervalMinutes)}
                    onValueChange={(value) => setIntervalMinutes(Number(value))}
                    disabled={!autoTracking}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKING_INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={String(interval.value)}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Individual products can opt out from their edit form.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      trackingMutation.mutate({
                        autoTrackingEnabled: autoTracking,
                        priceUpdateIntervalMinutes: intervalMinutes
                      })
                    }
                    loading={trackingMutation.isPending}
                  >
                    <Save className="h-4 w-4" /> Save tracking
                  </Button>
                </div>
              </div>
            </Card>

            {data.isOwner ? <Card>
              <SettingsHeading icon={ShieldCheck} title="Invite an account" description="Each person gets a separate private collection." />
              <div className="space-y-3 p-5">
                <Button onClick={() => invitationMutation.mutate()} loading={invitationMutation.isPending}>Create invitation link</Button>
                {invitationLink ? <div className="space-y-2">
                  <Input readOnly value={invitationLink} aria-label="Invitation link" />
                  <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(invitationLink).then(() => toast.success("Link copied"))}>Copy link</Button>
                  <p className="text-[11px] text-muted-foreground">The link expires in seven days and can be used once. Share it privately.</p>
                </div> : null}
              </div>
            </Card> : null}

            {data.isOwner ? <Card>
              <SettingsHeading
                icon={Archive}
                title="Backups"
                description="One ZIP contains the SQLite database and every locally stored image."
              />
              <div className="p-5">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-gradient-to-br bg-card bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Create a fresh backup</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {settings.lastBackupAt
                          ? `Last backup ${timeAgo(settings.lastBackupAt)} · ${formatDateTime(settings.lastBackupAt)}`
                          : "No backup has been created yet."}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => backupMutation.mutate()} loading={downloadingBackup}>
                    {!downloadingBackup ? <Download className="h-4 w-4" /> : null}
                    Download backup
                  </Button>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Stored backups
                    </p>
                    <span className="text-[10px] text-muted-foreground">Up to 12 kept</span>
                  </div>
                  {data.backups.length ? (
                    <div className="divide-y divide-border/70 rounded-lg border border-border/80">
                      {data.backups.map((backup) => (
                        <div key={backup.filename} className="flex items-center gap-3 px-3 py-2.5">
                          <Archive className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{backup.filename}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDateTime(backup.createdAt)} · {formatBytes(backup.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void downloadExisting(backup)}
                            disabled={downloadingFile === backup.filename}
                            aria-label={`Download ${backup.filename}`}
                          >
                            {downloadingFile === backup.filename ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-[11px] text-muted-foreground">
                      Backups you create will be listed here.
                    </p>
                  )}
                </div>

                <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-destructive">Restore from a backup</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-destructive">
                        Restoring replaces the current database and images. A safety backup is created first, and the previous
                        data is kept if the restore cannot be validated.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          ref={restoreInputRef}
                          type="file"
                          accept=".zip,application/zip"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setRestoreFile(file);
                            setRestoreOpen(true);
                          }}
                        />
                        <Button variant="outline" size="sm" onClick={() => restoreInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5" /> Choose backup ZIP
                        </Button>
                        {restoreFile ? <span className="truncate text-[10px] text-muted-foreground">{restoreFile.name}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card> : null}
          </div>

          <div className="space-y-5 xl:col-span-5">
            {data.isOwner ? <Card>
              <SettingsHeading
                icon={Database}
                title="Local storage"
              description="Storage and backup details for the server."
              />
              <div className="space-y-4 p-5">
                <StorageRow
                  icon={Database}
                  label="Database"
                  value={formatBytes(database?.size ?? 0)}
                  detail={database?.path ?? "data/gift-vault.db"}
                />
                <StorageRow
                  icon={ImageIcon}
                  label="Images"
                  value={formatBytes(database?.uploadsSize ?? 0)}
                  detail={database?.uploadsPath ?? "data/uploads"}
                />
                <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
                  <CountFact label="Products" value={database?.counts.products ?? 0} />
                  <CountFact label="Categories" value={database?.counts.categories ?? 0} />
                  <CountFact label="Stores" value={database?.counts.stores ?? 0} />
                  <CountFact label="Price records" value={database?.counts.priceHistory ?? 0} />
                  <CountFact label="Groups" value={database?.counts.groups ?? 0} />
                  <CountFact label="Tags" value={database?.counts.tags ?? 0} />
                </div>
              </div>
            </Card> : null}

            <Card>
              <SettingsHeading icon={Info} title="About Gift Vault" description="A private gift collection for your account." />
              <div className="space-y-3 p-5 text-xs">
                <AboutRow label="Version" value={data.app.version} />
                <AboutRow label="Runtime" value={data.app.runtime} />
                <AboutRow label="Storage" value={data.app.storage} />
                {data.isOwner ? <AboutRow label="Backup folder" value={data.app.backupDirectory} /> : null}
                <div className="mt-4 rounded-lg border border-border/80 bg-card p-3">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium">Your collection is private</span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    Your products, categories, groups, settings, price records and images are kept separate from other accounts.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-gradient-to-br bg-card bg-card p-5">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">A small reminder</p>
              </div>
              <p className="mt-2 font-display text-lg leading-snug tracking-[-0.02em]">
                The best gifts are remembered, not rushed.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Use notes and tags to capture the details that matter. Price history will do the patient work in the
                background.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={(open) => {
          setRestoreOpen(open);
          if (!open) {
            setRestoreFile(null);
            if (restoreInputRef.current) restoreInputRef.current.value = "";
          }
        }}
        title="Restore this backup?"
        description={`This replaces the current database and local images with the contents of ${restoreFile?.name ?? "the selected backup"}. A safety backup is created first.`}
        confirmLabel="Restore backup"
        loading={restoreMutation.isPending}
        onConfirm={() => {
          if (restoreFile) restoreMutation.mutate(restoreFile);
        }}
      />
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function SettingsHeading({
  icon: Icon,
  title,
  description
}: {
  icon: typeof Database;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StorageRow({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-xs font-semibold">{value}</p>
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function CountFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
      <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
      <div className="space-y-5 xl:col-span-5">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
    </div>
  );
}
