import React, { useState, useEffect } from 'react';
import { PublicEstimate } from '../types/estimate';
import { estimateShareApi } from '../api/estimatesApi';
import { generateWebHTML } from '../webTemplate'; // 🆕 Import från samma nivå som components

interface PublicEstimateViewProps {
  token: string;
}

export function PublicEstimateView({ token }: PublicEstimateViewProps) {
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    loadEstimate();
  }, [token]);

  const loadEstimate = async () => {
    try {
      setLoading(true);
      const publicEstimate = await estimateShareApi.getPublicEstimate(token);
      setEstimate(publicEstimate);
    } catch (error) {
      console.error('Failed to load public estimate:', error);
      setError(error instanceof Error ? error.message : 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  };

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
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Estimate Not Available
            </h2>
            <p className="text-gray-600 mb-4">
              {error || 'This estimate could not be found or the share link has expired.'}
            </p>
            <a 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 🆕 Generate HTML using webTemplate.ts
  const webHTML = generateWebHTML(estimate);

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: webHTML }}
      className="web-template-container"
    />
  );
}