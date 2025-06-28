
# Database Maintenance & Optimization Guide

## What to Clean
- Remove unused or test data that no longer supports the app's logic.
- Deduplicate entries using unique keys (e.g., referee ID, match ID).
- Remove or archive records marked as soft-deleted or inactive.
- Validate and fix broken foreign key references.

## When to Run
- Only when I specifically say: "optimize the database".
- Especially after large data imports or test runs.
- Before major deployments, if requested.

## What Not to Touch
- Do not delete historical logs unless older than 6 months.
- Do not modify schemas or constraints unless specifically instructed.

## Optimization Trigger
This file defines the official optimization routine. You are only allowed to perform these steps when I clearly instruct you to "optimize the database". Read this guide carefully and follow the instructions in order.
