# Repository Audit

This document summarizes the issues found during the TypeScript build and code review, and proposes a safe plan to fix them without regressing existing functionality.

## Build status

- `npm run check` fails with 42 TypeScript errors across 10 files. The majority stem from stale type definitions, duplicated modules, and API updates that were not reflected in the UI layer. 【df522a†L1-L83】

## Frontend issues

### 1. Layout module duplicated
- `client/src/components/layout/Layout.tsx` contains two identical copies of the same component exports, causing duplicate identifier errors at build time. 【F:client/src/components/layout/Layout.tsx†L1-L100】
- **Plan:** Remove the duplicated block and ensure the layout helpers (`Page`, `Toolbar`, `Card`, `StatGrid`, `StatBox`) are exported once. Add a regression test (TypeScript check) to confirm the duplicates are gone.

### 2. Higher-order component typing regression
- The `withLayout` helper in `client/src/App.tsx` declares a generic `<P>` without constraining JSX intrinsic attributes, which breaks when passed to `wouter` routes (`Type 'P' is not assignable to type 'IntrinsicAttributes & P'`). 【F:client/src/App.tsx†L31-L48】
- **Plan:** Update `withLayout` so that it preserves the wrapped component's props while satisfying `Route`'s expectations (e.g., constrain `P` to `JSX.IntrinsicAttributes` or use `ComponentType<RouteComponentProps>`). Verify by re-running `npm run check` and exercising a smoke test locally.

### 3. Toast helper type drift
- `client/src/hooks/use-toast.ts` allows `ReactNode` titles/descriptions, but the toast component type only accepts strings, triggering assignment errors. 【F:client/src/hooks/use-toast.ts†L170-L222】
- **Plan:** Align the toast helper with the actual component contract by either widening the UI component props to accept `ReactNode` or constraining the helper to strings. After the change, re-run `npm run check` and manually verify toasts still render.

### 4. Scanner indicator type mismatch
- `TechnicalIndicators` defines its own `ScanResult` shape that conflicts with the page-level `ScanResult` interface (required `value` vs. optional `value`). 【F:client/src/components/scanner/technical-indicators.tsx†L1-L80】【F:client/src/pages/charts.tsx†L1-L60】
- **Plan:** Centralize the scan result typings (e.g., export a shared type from `@shared/scanner/types`) so both the component and page agree on optional fields. Update both modules to import the shared type and rerun the TypeScript check.

### 5. Watchlist and scan helpers using implicit `any`
- Several `map` callbacks (`charts.tsx`, `analyse.tsx`) rely on implicit `any` parameters, hiding potential runtime issues. 【F:client/src/pages/charts.tsx†L420-L456】【F:client/src/pages/analyse.tsx†L484-L520】
- **Plan:** Type the watchlist and history collections (e.g., `WatchlistItem[]`) so callbacks receive proper inference. Rerun `npm run check` to ensure no implicit `any` remain.

### 6. Auth helper signature too narrow
- `isUnauthorizedError` only accepts `Error`, yet callers often pass `unknown` from catch blocks, causing type errors. 【F:client/src/pages/charts.original.backup.tsx†L174-L204】【F:client/src/lib/authUtils.ts†L1-L3】
- **Plan:** Broaden `isUnauthorizedError` to accept `unknown` and perform an `instanceof Error` guard internally so existing runtime behavior is preserved.

### 7. Portfolio summary typo
- `client/src/pages/home.tsx` tries to read `totalPnlPercent` (lowercase `l`) which does not exist; the correct property is `totalPnLPercent`. 【F:client/src/pages/home.tsx†L36-L88】
- **Plan:** Normalize the property access (or update the DTO type) to eliminate the typo. Validate by loading the dashboard after the fix.

### 8. Firebase WebSocket shim linting issue
- `client/src/lib/disableLocalWs.ts` relies on `@ts-expect-error` markers to wrap the native constructor, which currently fail the build. 【F:client/src/lib/disableLocalWs.ts†L1-L40】
- **Plan:** Refactor the shim to use `unknown` casts or helper types instead of `@ts-expect-error` so it compiles cleanly while preserving behavior that blocks the local `/ws` endpoint.

## Shared/server issues

### 11. Missing UUID dependency
- `shared/schema.ts` references `uuidv4`, but `uuid` is not listed in `package.json`, so runtime imports will fail once the module is actually executed. 【F:shared/schema.ts†L1-L40】【F:package.json†L1-L80】
- **Plan:** Add `uuid` and `@types/uuid` as dependencies, rerun `npm install`, and update the lockfile. Consider switching to `crypto.randomUUID()` if Node runtime permits.

## Security & maintenance

- `npm install` reports 15 moderate vulnerabilities. 【89532a†L1-L11】
- **Plan:** Run `npm audit` to review the advisories. Apply `npm audit fix` where non-breaking or upgrade direct dependencies manually, testing the app afterwards.

## Next steps

1. Deduplicate and clean up the layout module, then rerun `npm run check` to verify most duplicate identifier errors vanish.
2. Address the typing regressions (HOC, toasts, shared scanner types, auth helper). This should reduce the TypeScript error count dramatically.
3. Update the watchlist pages for React Query v5 and strict typing, then re-run the TypeScript check until it passes.
4. Add the missing `uuid` dependency (or replace with `crypto.randomUUID`) and patch any npm vulnerabilities.
5. Once the build is green, perform manual smoke tests for authentication, scanner interactions, watchlist management, and toast notifications to ensure fixes did not break existing UX flows.

