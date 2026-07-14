import { AlertTriangle, ImagePlus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { Button, SectionHeader, TextInput, Textarea } from "@/components/meridian";
import {
  type BrandAdapter,
  type BrandFontPreference,
  type BrandProfile,
  type BrandTone,
  type LoadState,
  validateBrandProfile,
} from "../context/contracts";
import { useAdapterResource } from "../context/useAdapterResource";
import { ReportPreview } from "./ReportPreview";

interface BrandPageProps {
  adapter: BrandAdapter;
}

export function BrandPage({ adapter }: BrandPageProps) {
  const load = useCallback(() => adapter.getBrandProfile(), [adapter]);
  const { state, reload } = useAdapterResource(load);

  return (
    <BrandPageView
      state={state}
      onSave={async (profile) => {
        const saved = await adapter.updateBrandProfile(profile);
        await reload();
        return saved;
      }}
      onUploadLogo={(file) => adapter.uploadLogo(file)}
      onRemoveLogo={async () => {
        await adapter.removeLogo();
        await reload();
      }}
      onReload={reload}
    />
  );
}

interface BrandPageViewProps {
  state: LoadState<BrandProfile>;
  onSave(profile: BrandProfile): void | BrandProfile | Promise<void | BrandProfile>;
  onUploadLogo(file: File): void | { logoUrl: string; logoName: string } | Promise<void | { logoUrl: string; logoName: string }>;
  onRemoveLogo(): void | Promise<void>;
  onReload(): void | Promise<void>;
}

export function BrandPageView({ state, onSave, onUploadLogo, onRemoveLogo, onReload }: BrandPageViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <SectionHeader
        eyebrow="Workspace identity"
        title="Brand"
        description="Set the identity Meridian uses when it turns customer evidence into reports your team can share."
        action={state.status === "ready" ? <Button variant="ghost" size="sm" onClick={() => void onReload()}><RefreshCw aria-hidden="true" />Refresh</Button> : undefined}
      />

      {state.status === "loading" ? <BrandLoading /> : null}
      {state.status === "error" ? <BrandError message={state.message} onReload={onReload} /> : null}
      {state.status === "ready" ? (
        <BrandEditor
          key={profileKey(state.data)}
          initialProfile={state.data}
          onSave={onSave}
          onUploadLogo={onUploadLogo}
          onRemoveLogo={onRemoveLogo}
        />
      ) : null}
    </main>
  );
}

function BrandEditor({
  initialProfile,
  onSave,
  onUploadLogo,
  onRemoveLogo,
}: {
  initialProfile: BrandProfile;
  onSave(profile: BrandProfile): void | BrandProfile | Promise<void | BrandProfile>;
  onUploadLogo(file: File): void | { logoUrl: string; logoName: string } | Promise<void | { logoUrl: string; logoName: string }>;
  onRemoveLogo(): void | Promise<void>;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [errors, setErrors] = useState(() => validateBrandProfile(initialProfile));
  const [status, setStatus] = useState<string>();
  const [saving, setSaving] = useState(false);

  function update<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateBrandProfile(profile);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setStatus("Check the highlighted brand fields.");
      return;
    }

    setSaving(true);
    setStatus(undefined);
    try {
      const saved = await onSave(profile);
      if (saved) setProfile(saved);
      setStatus("Brand profile saved.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Brand profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Choose a PNG, JPG, SVG, or WebP image.");
      event.target.value = "";
      return;
    }

    setSaving(true);
    setStatus(undefined);
    try {
      const uploaded = await onUploadLogo(file);
      if (uploaded) setProfile((current) => ({ ...current, ...uploaded }));
      setStatus("Logo uploaded. Save the brand profile to keep this preview.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Logo could not be uploaded.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  async function removeLogo() {
    setSaving(true);
    setStatus(undefined);
    try {
      await onRemoveLogo();
      setProfile((current) => ({ ...current, logoUrl: undefined, logoName: undefined }));
      setStatus("Logo removed.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Logo could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
      <form onSubmit={save} className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-xs)] sm:p-7">
        <fieldset disabled={saving} className="space-y-7">
          <legend className="sr-only">Brand profile settings</legend>

          <FormSection title="Identity" description="Use the name and logo customers already recognize.">
            <Field label="Display name" htmlFor="brand-display-name" error={errors.displayName}>
              <TextInput id="brand-display-name" value={profile.displayName} onChange={(event) => update("displayName", event.target.value)} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "brand-display-name-error" : undefined} />
            </Field>
            <div>
              <p className="mb-1.5 [font:var(--text-label)] text-[var(--text-heading)]">Logo</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 [font:var(--text-label)] text-[var(--text-heading)] shadow-[var(--shadow-xs)] hover:bg-[var(--ivory-100)] focus-within:shadow-[var(--focus-ring)]">
                  <ImagePlus aria-hidden="true" size={16} />{profile.logoName ? "Replace logo" : "Upload logo"}
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(event) => void uploadLogo(event)} />
                </label>
                {profile.logoName ? <span className="max-w-52 truncate [font:var(--text-body-sm)] text-[var(--text-secondary)]">{profile.logoName}</span> : null}
                {profile.logoUrl ? <Button type="button" variant="ghost" size="sm" onClick={() => void removeLogo()}><Trash2 aria-hidden="true" />Remove</Button> : null}
              </div>
              <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-muted)]">PNG, JPG, SVG, or WebP. A compact horizontal mark works best.</p>
            </div>
          </FormSection>

          <FormSection title="Report color" description="Colors apply to covers, section markers, and evidence callouts.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField id="brand-primary" label="Primary" value={profile.primaryColor} error={errors.primaryColor} onChange={(value) => update("primaryColor", value)} />
              <ColorField id="brand-accent" label="Accent" value={profile.accentColor} error={errors.accentColor} onChange={(value) => update("accentColor", value)} />
            </div>
          </FormSection>

          <FormSection title="Report language" description="Keep every generated report aligned with how your team communicates.">
            <Field label="Report title" htmlFor="brand-report-title" error={errors.reportTitle}>
              <TextInput id="brand-report-title" value={profile.reportTitle} onChange={(event) => update("reportTitle", event.target.value)} aria-invalid={Boolean(errors.reportTitle)} />
            </Field>
            <Field label="Footer" htmlFor="brand-report-footer" error={errors.reportFooter}>
              <Textarea id="brand-report-footer" value={profile.reportFooter} onChange={(event) => update("reportFooter", event.target.value)} aria-invalid={Boolean(errors.reportFooter)} className="min-h-20" />
            </Field>
            <ChoiceField<BrandTone> legend="Voice" name="brand-tone" value={profile.tone} options={[{ value: "precise", label: "Precise" }, { value: "warm", label: "Warm" }, { value: "direct", label: "Direct" }]} onChange={(value) => update("tone", value)} />
          </FormSection>

          <FormSection title="Typography" description="Choose a broad direction; final exports use compatible production fonts.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceField<BrandFontPreference> legend="Headings" name="heading-font" value={profile.headingFont} options={[{ value: "serif", label: "Editorial serif" }, { value: "sans", label: "Modern sans" }]} onChange={(value) => update("headingFont", value)} />
              <ChoiceField<BrandFontPreference> legend="Body" name="body-font" value={profile.bodyFont} options={[{ value: "sans", label: "Clear sans" }, { value: "serif", label: "Classic serif" }]} onChange={(value) => update("bodyFont", value)} />
            </div>
          </FormSection>
        </fieldset>

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--border-default)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="min-h-5 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{status}</p>
          <Button type="submit" disabled={saving}><Save aria-hidden="true" />{saving ? "Saving…" : "Save brand profile"}</Button>
        </div>
      </form>

      <aside className="lg:sticky lg:top-6">
        <div className="mb-3">
          <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Live preview</p>
          <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">A representative cover, updated as you edit.</p>
        </div>
        <ReportPreview profile={profile} />
      </aside>
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--border-default)] pb-7 last:border-b-0 last:pb-0">
      <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">{title}</h2>
      <p className="mb-4 mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{description}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  const errorId = `${htmlFor}-error`;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block [font:var(--text-label)] text-[var(--text-heading)]">{label}</label>
      {children}
      {error ? <p id={errorId} role="alert" className="mt-1.5 [font:var(--text-body-sm)] text-[var(--status-danger)]">{error}</p> : null}
    </div>
  );
}

function ColorField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange(value: string): void }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex items-center gap-2">
        <input id={`${id}-picker`} aria-label={`${label} color picker`} type="color" value={validColor(value)} onChange={(event) => onChange(event.target.value.toUpperCase())} className="size-10 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-default)] bg-transparent p-1" />
        <TextInput id={id} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="font-mono uppercase" maxLength={7} />
      </div>
    </Field>
  );
}

function ChoiceField<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void }) {
  return (
    <fieldset>
      <legend className="mb-2 [font:var(--text-label)] text-[var(--text-heading)]">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input className="peer sr-only" type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span className="inline-flex h-9 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-page)] px-3 [font:var(--text-body-sm)] text-[var(--text-secondary)] peer-checked:border-[var(--ink-900)] peer-checked:bg-[var(--ink-900)] peer-checked:text-[var(--ivory-100)] peer-focus-visible:shadow-[var(--focus-ring)]">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BrandLoading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
      <div className="h-[620px] animate-pulse rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-card)]" />
      <div>
        <p className="mb-3 [font:var(--text-label)] text-[var(--text-heading)]">Loading brand profile…</p>
        <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-xl)] bg-[var(--ivory-200)]" />
      </div>
    </div>
  );
}

function BrandError({ message, onReload }: { message: string; onReload(): void | Promise<void> }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--red-100)] bg-[var(--red-100)] p-5 sm:flex-row sm:items-center">
      <AlertTriangle aria-hidden="true" className="shrink-0 text-[var(--status-danger)]" size={20} />
      <div className="flex-1"><p className="[font:var(--text-label)] text-[var(--text-heading)]">Brand profile is unavailable</p><p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{message}</p></div>
      <Button variant="secondary" size="sm" onClick={() => void onReload()}>Try again</Button>
    </div>
  );
}

function validColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value) ? value : "#171612";
}

function profileKey(profile: BrandProfile) {
  return [profile.displayName, profile.logoUrl, profile.primaryColor, profile.accentColor, profile.reportTitle, profile.reportFooter, profile.tone, profile.headingFont, profile.bodyFont].join("|");
}
