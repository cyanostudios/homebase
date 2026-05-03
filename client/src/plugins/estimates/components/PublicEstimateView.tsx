import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { dedupeInFlightByKey } from '@/core/utils/dedupeInFlightByKey';

import { estimateShareApi } from '../api/estimatesApi';
import { PublicEstimate } from '../types/estimate';
import { generateWebHTML } from '../webTemplate';

interface PublicEstimateViewProps {
  token: string;
}

export function PublicEstimateView({ token }: PublicEstimateViewProps) {
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumps so "Try again" after failure issues a new fetch (and new view count). */
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const key = `public-estimate:${token}:${loadAttempt}`;
        const publicEstimate = await dedupeInFlightByKey(key, () =>
          estimateShareApi.getPublicEstimate(token),
        );
        if (!cancelled) {
          setEstimate(publicEstimate);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load estimate');
          setEstimate(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, loadAttempt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading estimate...</div>
        </div>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto opacity-50" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Estimate Not Available</h2>
            <p className="text-gray-600 mb-4">
              {error || 'This estimate could not be found or the share link has expired.'}
            </p>
            <Button
              variant="default"
              onClick={() => {
                setLoadAttempt((n) => n + 1);
              }}
              className="mr-2"
            >
              Try Again
            </Button>
            <Button variant="secondary" asChild>
              <a href="/">Go to Homepage</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const templateInput = {
    ...estimate,
    createdAt:
      estimate.createdAt instanceof Date
        ? estimate.createdAt.toISOString()
        : (estimate.createdAt as any),
    updatedAt:
      estimate.updatedAt instanceof Date
        ? estimate.updatedAt.toISOString()
        : (estimate.updatedAt as any),
    validTo:
      estimate.validTo instanceof Date ? estimate.validTo.toISOString() : (estimate.validTo as any),
    shareValidUntil:
      estimate.shareValidUntil instanceof Date
        ? estimate.shareValidUntil.toISOString()
        : (estimate.shareValidUntil as any),
  } as any;

  const webHTML = generateWebHTML(templateInput);

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        srcDoc={webHTML}
        className="w-full h-full border-none"
        title={`Estimate ${estimate.estimateNumber}`}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
