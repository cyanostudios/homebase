import {
  Check,
  CheckCircle,
  ChevronLeft,
  Inbox,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Shirt,
  Tag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { requestsApi } from '../api/requestsApi';
import type { PublicTeam } from '../types/requests';
import { resolvePublicRequestTypes, resolvePublicWebsiteHref } from '../utils/publicBranding';
import type { PublicRequestType } from '../utils/requestTypeConfig';

type Step = 1 | 2 | 3;

type TypeMeta = {
  icon: LucideIcon;
  labelEn: string;
  labelSv: string;
  descEn: string;
  descSv: string;
};

const BUILTIN_TYPE_META: Record<string, TypeMeta> = {
  general: {
    icon: MessageCircle,
    labelEn: 'General inquiry',
    labelSv: 'Allmän fråga',
    descEn: 'Questions, feedback, or something that does not fit the other options.',
    descSv: 'Frågor, synpunkter eller något som inte passar de andra alternativen.',
  },
  pitch_booking: {
    icon: MapPin,
    labelEn: 'Book a pitch',
    labelSv: 'Boka plan',
    descEn: 'Request a training or match slot on a pitch.',
    descSv: 'Begär träningstid eller matchtid på en plan.',
  },
  person_registration: {
    icon: UserPlus,
    labelEn: 'Register a person',
    labelSv: 'Registrera person',
    descEn: 'Sign someone up as a player, coach, or contact.',
    descSv: 'Anmäl spelare, tränare eller kontaktperson.',
  },
  Registration: {
    icon: UserPlus,
    labelEn: 'Registration',
    labelSv: 'Registration',
    descEn: 'Sign someone up as a player, coach, or contact.',
    descSv: 'Anmäl spelare, tränare eller kontaktperson.',
  },
  Kläder: {
    icon: Shirt,
    labelEn: 'Clothes',
    labelSv: 'Kläder',
    descEn: 'Order or inquire about team clothing and kit.',
    descSv: 'Beställ eller fråga om lagkläder och utrustning.',
  },
  other: {
    icon: MoreHorizontal,
    labelEn: 'Other',
    labelSv: 'Övrigt',
    descEn: 'Anything else you need help with.',
    descSv: 'Allt annat du behöver hjälp med.',
  },
};

function resolveTypeMeta(type: string): TypeMeta {
  if (BUILTIN_TYPE_META[type]) {
    return BUILTIN_TYPE_META[type];
  }
  return {
    icon: Tag,
    labelEn: type,
    labelSv: type,
    descEn: 'Submit a request of this type.',
    descSv: 'Skicka in ett ärende av den här typen.',
  };
}

const fieldClassName =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

const INTAKE_LABELS: Record<string, { en: string; sv: string }> = {
  name: { en: 'Name', sv: 'Namn' },
  shirtSize: { en: 'Shirt', sv: 'Tröja' },
  shortsSize: { en: 'Shorts', sv: 'Shorts' },
  socksSize: { en: 'Socks', sv: 'Strumpor' },
  jerseyNumber: { en: 'No.', sv: 'Nr' },
  jerseyName: { en: 'Name on jersey', sv: 'Namn på tröja' },
  initials: { en: 'Initials', sv: 'Initialer' },
  comment: { en: 'Comment', sv: 'Kommentar' },
};

interface PublicRequestFormProps {
  lang?: 'en' | 'sv';
  onSuccess?: () => void;
}

export function PublicRequestForm({ lang = 'sv', onSuccess }: PublicRequestFormProps) {
  const t = (key: string): string => {
    const sv: Record<string, string> = {
      pageTitle: 'Skicka in en förfrågan',
      pageSubtitle: 'Svara på några korta frågor så återkommer vi till dig.',
      back: 'Tillbaka',
      continue: 'Fortsätt',
      step1Title: 'Hej, hur kan vi hjälpa dig?',
      step1Subtitle: 'Välj det alternativ som bäst beskriver ditt ärende.',
      step2Title: 'Berätta mer',
      step2Subtitle: 'En kort rubrik räcker — beskrivningen är valfri.',
      intakeStepTitle: 'Berätta om personen',
      intakeStepSubtitle: 'Storlekar och tröjuppgifter hjälper oss förbereda klädlistan.',
      intakeNameHint: 'Namn på personen i klädlistan',
      contactStepPrefillHint: 'Används om vi behöver nå dig',
      step3Title: 'Hur når vi dig?',
      step3Subtitle: 'Valfritt, men underlättar om vi behöver kontakta dig.',
      team: 'Gäller lag (valfritt)',
      teamPlaceholder: 'Välj lag eller lämna tomt för allmän fråga',
      subject: 'Ämne / rubrik',
      subjectPlaceholder: 'Beskriv ärendet kort...',
      description: 'Beskrivning (valfritt)',
      descriptionPlaceholder: 'Berätta mer om ditt ärende...',
      name: 'Ditt namn',
      namePlaceholder: 'Förnamn Efternamn',
      email: 'E-postadress',
      emailPlaceholder: 'din@epost.se',
      submit: 'Skicka förfrågan',
      submitting: 'Skickar...',
      successTitle: 'Tack för din förfrågan!',
      successText: 'Vi har tagit emot ditt ärende och återkommer till dig så snart vi kan.',
      errorGeneral: 'Något gick fel. Försök igen.',
      requiredTitle: 'Rubrik är obligatorisk.',
      requiredType: 'Välj ett alternativ för att fortsätta.',
      requiredIntake: 'Fyll i obligatoriska fält.',
      toWebsite: 'To website',
      contactEmail: 'Email',
    };
    const en: Record<string, string> = {
      pageTitle: 'Submit a request',
      pageSubtitle: 'Answer a few short questions and we will get back to you.',
      back: 'Back',
      continue: 'Continue',
      step1Title: 'Hi, how can we help?',
      step1Subtitle: 'Pick the option that best describes your request.',
      step2Title: 'Tell us more',
      step2Subtitle: 'A short title is enough — description is optional.',
      intakeStepTitle: 'Tell us about the person',
      intakeStepSubtitle: 'Sizes and jersey details help us prepare the kit list.',
      intakeNameHint: 'Name of the person on the kit list',
      contactStepPrefillHint: 'Used if we need to reach you',
      step3Title: 'How can we reach you?',
      step3Subtitle: 'Optional, but helpful if we need to contact you.',
      team: 'Related team (optional)',
      teamPlaceholder: 'Select a team or leave empty for general inquiry',
      subject: 'Subject / title',
      subjectPlaceholder: 'Briefly describe your request...',
      description: 'Description (optional)',
      descriptionPlaceholder: 'Tell us more about your request...',
      name: 'Your name',
      namePlaceholder: 'First Last',
      email: 'Email address',
      emailPlaceholder: 'your@email.com',
      submit: 'Submit request',
      submitting: 'Submitting...',
      successTitle: 'Thanks for your request!',
      successText: 'We have received your inquiry and will get back to you as soon as possible.',
      errorGeneral: 'Something went wrong. Please try again.',
      requiredTitle: 'Title is required.',
      requiredType: 'Select an option to continue.',
      requiredIntake: 'Please fill in required fields.',
      toWebsite: 'To website',
      contactEmail: 'Email',
    };
    return (lang === 'sv' ? sv : en)[key] || key;
  };

  const intakeLabel = (fieldKey: string): string => {
    const labels = INTAKE_LABELS[fieldKey];
    if (!labels) {
      return fieldKey;
    }
    return lang === 'sv' ? labels.sv : labels.en;
  };

  const [step, setStep] = useState<Step>(1);
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [requestTypes, setRequestTypes] = useState<PublicRequestType[]>([]);
  const [branding, setBranding] = useState<{
    name: string;
    logoUrl: string;
    website: string;
    email: string;
  }>({
    name: '',
    logoUrl: '',
    website: '',
    email: '',
  });
  const [form, setForm] = useState({
    requestType: '',
    teamId: '',
    title: '',
    description: '',
    name: '',
    email: '',
  });
  const [extraData, setExtraData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const prefilledSubmitterFromIntake = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requestsApi.publicGetTeams().catch(() => [] as PublicTeam[]),
      requestsApi.publicGetBranding().catch(() => ({
        name: '',
        logoUrl: '',
        website: '',
        email: '',
        requestTypes: [] as PublicRequestType[],
      })),
    ])
      .then(([list, brand]) => {
        if (cancelled) {
          return;
        }
        setTeams(list);
        setBranding({
          name: brand.name,
          logoUrl: brand.logoUrl,
          website: brand.website,
          email: brand.email,
        });
        setRequestTypes(resolvePublicRequestTypes(brand.requestTypes));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType = useMemo(
    () => requestTypes.find((type) => type.key === form.requestType) ?? null,
    [requestTypes, form.requestType],
  );

  const isGarmentsIntake =
    selectedType?.plugin === 'garments' &&
    Array.isArray(selectedType.intakeSchema) &&
    selectedType.intakeSchema.length > 0;

  const intakeSchema = isGarmentsIntake ? selectedType!.intakeSchema! : [];

  const derivedTitle = useMemo(() => {
    if (!isGarmentsIntake) {
      return form.title.trim();
    }
    const name = (extraData.name || '').trim();
    const jersey = (extraData.jerseyNumber || '').trim();
    if (name && jersey) {
      return `${name} (#${jersey})`;
    }
    return name;
  }, [isGarmentsIntake, form.title, extraData.name, extraData.jerseyNumber]);

  const canProceedStep1 = Boolean(form.requestType);
  const canProceedStep2 = isGarmentsIntake
    ? intakeSchema.every((field) => {
        if (field.required !== true) {
          return true;
        }
        return Boolean((extraData[field.key] || '').trim());
      }) && Boolean(derivedTitle)
    : Boolean(form.title.trim());

  const selectRequestType = (typeKey: string) => {
    setError('');
    setForm((prev) => ({
      ...prev,
      requestType: typeKey,
      title: '',
      description: '',
    }));
    setExtraData({});
    prefilledSubmitterFromIntake.current = false;
  };

  const goBack = () => {
    setError('');
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const goNext = () => {
    setError('');
    if (step === 1) {
      if (!canProceedStep1) {
        setError(t('requiredType'));
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canProceedStep2) {
        setError(isGarmentsIntake ? t('requiredIntake') : t('requiredTitle'));
        return;
      }
      if (isGarmentsIntake && !prefilledSubmitterFromIntake.current) {
        const intakeName = (extraData.name || '').trim();
        if (intakeName) {
          setForm((prev) => ({
            ...prev,
            name: prev.name.trim() ? prev.name : intakeName,
          }));
          prefilledSubmitterFromIntake.current = true;
        }
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.requestType) {
      setError(t('requiredType'));
      setStep(1);
      return;
    }
    if (!canProceedStep2) {
      setError(isGarmentsIntake ? t('requiredIntake') : t('requiredTitle'));
      setStep(2);
      return;
    }
    setIsSubmitting(true);
    try {
      const payloadExtra: Record<string, string> | undefined = isGarmentsIntake
        ? Object.fromEntries(
            Object.entries(extraData)
              .map(([key, value]) => [key, value.trim()])
              .filter(([, value]) => Boolean(value)),
          )
        : undefined;

      await requestsApi.publicSubmit({
        title: derivedTitle,
        description: isGarmentsIntake ? undefined : form.description.trim() || undefined,
        request_type: form.requestType,
        team_id: form.teamId ? Number(form.teamId) : null,
        submitter_name: form.name.trim() || undefined,
        submitter_email: form.email.trim() || undefined,
        extra_data: payloadExtra && Object.keys(payloadExtra).length > 0 ? payloadExtra : undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitle =
    step === 1
      ? t('step1Title')
      : step === 2
        ? isGarmentsIntake
          ? t('intakeStepTitle')
          : t('step2Title')
        : t('step3Title');
  const stepSubtitle =
    step === 1
      ? t('step1Subtitle')
      : step === 2
        ? isGarmentsIntake
          ? t('intakeStepSubtitle')
          : t('step2Subtitle')
        : t('step3Subtitle');
  const websiteHref = resolvePublicWebsiteHref(branding.website);
  const showContactMeta = Boolean(websiteHref || branding.email.trim());

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center gap-3 px-1">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name || ''}
              className="h-10 w-10 shrink-0 rounded-xl object-contain bg-white ring-1 ring-border"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
              <Inbox className="h-5 w-5 text-violet-600" aria-hidden />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {branding.name || t('pageTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {branding.name ? t('pageTitle') : t('pageSubtitle')}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          {submitted ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('successText')}</p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()}
              className="space-y-5"
            >
              <div className="flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    {t('back')}
                  </button>
                ) : (
                  <span className="w-16" aria-hidden />
                )}
                <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
                  {([1, 2, 3] as const).map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 w-8 rounded-full ${
                        n <= step ? 'bg-violet-600' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-b border-border pb-4">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {stepTitle}
                </h2>
                <p className="text-sm text-muted-foreground">{stepSubtitle}</p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-2.5" role="radiogroup" aria-label={t('step1Title')}>
                  {requestTypes.map((type) => {
                    const meta = resolveTypeMeta(type.key);
                    const Icon = meta.icon;
                    const selected = form.requestType === type.key;
                    const label = lang === 'sv' ? meta.labelSv : meta.labelEn;
                    const desc = lang === 'sv' ? meta.descSv : meta.descEn;
                    return (
                      <button
                        key={type.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectRequestType(type.key)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                          selected
                            ? 'border-violet-600 bg-violet-50 ring-2 ring-violet-600'
                            : 'border-border bg-white hover:bg-muted/40'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            selected ? 'bg-violet-100 text-violet-700' : 'bg-muted text-foreground'
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-semibold ${
                              selected ? 'text-violet-800' : 'text-foreground'
                            }`}
                          >
                            {label}
                          </span>
                          <span
                            className={`mt-0.5 block text-xs ${
                              selected ? 'text-violet-700/80' : 'text-muted-foreground'
                            }`}
                          >
                            {desc}
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-muted-foreground/40 bg-white'
                          }`}
                          aria-hidden
                        >
                          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {!isLoading && teams.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        {t('team')}
                      </label>
                      <select
                        value={form.teamId}
                        onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}
                        autoFocus
                        className={fieldClassName}
                      >
                        <option value="">{t('teamPlaceholder')}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {formatTeamLabel(team) || team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isGarmentsIntake ? (
                    intakeSchema.map((field, index) => {
                      const required = field.required === true;
                      const isComment = field.key === 'comment';
                      const isName = field.key === 'name';
                      return (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">
                            {intakeLabel(field.key)}
                            {required ? <span className="text-red-500"> *</span> : null}
                          </label>
                          {isName ? (
                            <p className="text-[11px] text-muted-foreground">
                              {t('intakeNameHint')}
                            </p>
                          ) : null}
                          {isComment ? (
                            <textarea
                              value={extraData[field.key] || ''}
                              onChange={(e) =>
                                setExtraData((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              rows={3}
                              aria-required={required}
                              autoFocus={index === 0 && (isLoading || teams.length === 0)}
                              className={fieldClassName}
                            />
                          ) : (
                            <input
                              type="text"
                              value={extraData[field.key] || ''}
                              onChange={(e) =>
                                setExtraData((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              required={required}
                              aria-required={required}
                              autoFocus={index === 0 && (isLoading || teams.length === 0)}
                              className={fieldClassName}
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t('subject')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.title}
                          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder={t('subjectPlaceholder')}
                          required
                          autoFocus={isLoading || teams.length === 0}
                          className={fieldClassName}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t('description')}
                        </label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder={t('descriptionPlaceholder')}
                          rows={4}
                          className={fieldClassName}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {t('name')}
                    </label>
                    {isGarmentsIntake ? (
                      <p className="text-[11px] text-muted-foreground">
                        {t('contactStepPrefillHint')}
                      </p>
                    ) : null}
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder={t('namePlaceholder')}
                      autoFocus
                      className={fieldClassName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder={t('emailPlaceholder')}
                      className={fieldClassName}
                    />
                  </div>
                </div>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
                >
                  {t('continue')}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {isSubmitting ? t('submitting') : t('submit')}
                </button>
              )}
            </form>
          )}
        </div>

        {showContactMeta && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground hover:underline"
              >
                {t('toWebsite')}
              </a>
            ) : null}
            {websiteHref && branding.email.trim() ? <span aria-hidden>·</span> : null}
            {branding.email.trim() ? (
              <a
                href={`mailto:${branding.email.trim()}`}
                className="hover:text-foreground hover:underline"
              >
                {t('contactEmail')}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
