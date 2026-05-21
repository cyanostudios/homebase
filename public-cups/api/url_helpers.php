<?php

declare(strict_types=1);

/**
 * Append utm_source=cupappen on outbound URLs (registration, JSON-LD offers).
 * Mirrors public-cups/app.js withCupappenUtm().
 */
function withCupappenUtm(string $urlValue): string
{
    $raw = trim($urlValue);
    if ($raw === '') {
        return '';
    }

    $parsed = parse_url($raw);
    if (is_array($parsed) && isset($parsed['scheme'], $parsed['host'])) {
        $query = [];
        if (!empty($parsed['query'])) {
            parse_str($parsed['query'], $query);
        }
        $query['utm_source'] = 'cupappen';
        $newQuery = http_build_query($query);

        $out = $parsed['scheme'] . '://' . $parsed['host'];
        if (isset($parsed['port'])) {
            $out .= ':' . $parsed['port'];
        }
        $out .= $parsed['path'] ?? '';
        if ($newQuery !== '') {
            $out .= '?' . $newQuery;
        }
        if (isset($parsed['fragment']) && $parsed['fragment'] !== '') {
            $out .= '#' . $parsed['fragment'];
        }

        return $out;
    }

    if (preg_match('/[?&]utm_source=/i', $raw)) {
        $out = preg_replace('/([?&])utm_source=[^&]*/i', '$1utm_source=cupappen', $raw) ?? $raw;

        return str_replace('?&', '?', $out);
    }

    $sep = str_contains($raw, '?') ? '&' : '?';

    return $raw . $sep . 'utm_source=cupappen';
}
