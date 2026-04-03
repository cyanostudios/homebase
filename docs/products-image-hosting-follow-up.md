# Product Image Hosting

## Current Slice

This first slice keeps the existing product contract unchanged:

- `products.main_image` stays a public URL string
- `products.images` stays an array of public URL strings

Hosted media is now intended to come from Backblaze B2 through backend-managed uploads.

## Required Environment Variables

Set these on the backend:

```env
STORAGE_DRIVER=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_BUCKET=your-bucket-name
B2_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-application-key
B2_PUBLIC_BASE_URL=https://f004.backblazeb2.com/file/your-bucket-name
MEDIA_MAX_FILE_BYTES=20971520
PRODUCT_MEDIA_FETCH_TIMEOUT_MS=15000
```

## Phase 2 Follow-up

When this hosted-originals slice is stable, the next phase should focus on:

1. Rich media metadata on products instead of plain URL arrays.
2. Generated image variants such as `original`, `preview`, and `thumbnail`.
3. UI updates that render preview variants while channels keep using originals.
4. Stronger dedupe based on content hash.
5. Better orphan cleanup for pending uploads that never get attached to a saved product.
