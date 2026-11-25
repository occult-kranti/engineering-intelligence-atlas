# Resource office integration validation

The retained resource-office work has been recovered into the backend integration
checkout and tested with the current native, cloud and editor changes. Earlier
Claude partial-response receipts remain unchanged; this report does not convert
them into successful provider builds or invent additional spend.

## Verified

- The canonical resource catalog contains 303 records. The atlas projection
  contains all 303 and requires no regeneration.
- Native and hosted selectors use matching canonical catalog identities and
  bounded packets. No company knowledge or credentials enter the public catalog.
- All 15 skill packages, seven public skill mirrors and the native brief bundle
  match their editable sources.
- All ten allowlisted hosted Three.js studio assets match the retained source.
- The resource router, renderer asset graph and resource-library suites passed
  32 tests, including real worker prompt/admission paths with provider doubles.
- The shared renderer builds successfully; 361 synthetic DOM interaction checks
  passed. Public and hosted asset graphs resolve their referenced files without
  content-hash mismatches.
- The static atlas build passed integrity checks for 219 client files.

```sh
node --test scripts/resource-router.test.mjs scripts/renderer-assets.test.mjs desktop-shell/tests/resource-library.test.mjs
python3 scripts/sync-resource-projections.py
node scripts/resource-router.mjs --check-atlas
python3 scripts/sync-skills.py --check
python3 scripts/sync-company-studios.py --check --target hosted
```

The corresponding checks are now part of the headless CI workflow. Public source
metadata is neither downloaded book content nor proof that a package/model is
installed. The two studio examples remain distinct from executed hardware or
production game work. Upstream source omissions are described in each studio's
project README without inventing replacement evidence.

See [the integrated backend validation](../BACKEND_WORKFLOW_VALIDATION_2026-11-24.md)
for source recovery, complete local results, production boundaries and the
bounded stress receipt. Browser/installed-device acceptance and a successful
publication are separate evidence; historical release results are not reused for
the new source tree.
