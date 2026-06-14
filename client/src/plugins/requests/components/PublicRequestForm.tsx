import { CheckCircle, Inbox, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { requestsApi } from '../api/requestsApi';
import type { PublicTeam } from '../types/requests';
import { REQUEST_TYPES } from '../types/requests';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  general: 'General inquiry',
  pitch_booking: 'Book a pitch',
  person_registration: 'Register a person',
  other: 'Other',
};

const REQUEST_TYPE_LABELS_SV: Record<string, string> = {
  general: 'Allmän fråga',
  pitch_booking: 'Boka plan',
  person_registration: 'Registrera person',
  other: 'Övrigt',
};

interface PublicRequestFormProps {
  lang?: 'en' | 'sv';
  onSuccess?: () => void;
}

export function PublicRequestForm({ lang = 'sv', onSuccess }: PublicRequestFormProps) {
  const labels = lang === 'sv' ? REQUEST_TYPE_LABELS_SV : REQUEST_TYPE_LABELS;
  const t = (key: string): string => {
    const sv: Record<string, string> = {
      title: 'Skicka in en förfrågan',
      subtitle: 'Fyll i formuläret nedan så återkommer vi till dig.',
      requestType: 'Typ av ärende',
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
    };
    const en: Record<string, string> = {
      title: 'Submit a request',
      subtitle: 'Fill in the form below and we will get back to you.',
      requestType: 'Request type',
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
    };
    return (lang === 'sv' ? sv : en)[key] || key;
  };

  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [form, setForm] = useState({
    requestType: 'general',
    teamId: '',
    title: '',
    description: '',
    name: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    requestsApi
      .publicGetTeams()
      .then((list) => setTeams(list))
      .catch(() => setTeams([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError(t('requiredTitle'));
      return;
    }
    setIsSubmitting(true);
    try {
      await requestsApi.publicSubmit({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        request_type: form.requestType,
        team_id: form.teamId ? Number(form.teamId) : null,
        submitter_name: form.name.trim() || undefined,
        submitter_email: form.email.trim() || undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-500" />
        <div>
          <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('successText')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
          <Inbox className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t('requestType')}</label>
          <select
            value={form.requestType}
            onChange={(e) => setForm((p) => ({ ...p, requestType: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {labels[type]}
              </option>
            ))}
          </select>
        </div>

        {!isLoading && teams.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{t('team')}</label>
            <select
              value={form.teamId}
              onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">{t('teamPlaceholder')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                  {team.age_group ? ` (${team.age_group})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t('description')}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder={t('descriptionPlaceholder')}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{t('name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{t('email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
