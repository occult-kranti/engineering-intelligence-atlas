# Optional licensed Photoshop API v2 adapter

This module implements two fixed official server operations: `adobe.manifest` for a PSD document and `adobe.render` for a PSD/PNG/JPEG input rendered to PNG/JPEG. It does not install Photoshop desktop on Linux, clone Adobe's proprietary implementation, execute arbitrary Photoshop action JSON, activate a license or start an API subscription.

Adobe documents an active Enterprise contract including Firefly Services, a Developer Console account and OAuth Server-to-Server credentials as prerequisites. A Creative Cloud desktop subscription alone does not establish this API entitlement. See [official prerequisites and OAuth](https://developer.adobe.com/firefly-services/docs/photoshop/getting-started/), [API v2 availability](https://developer.adobe.com/firefly-services/docs/photoshop/getting-started/v2-ga/), [manifest migration](https://developer.adobe.com/firefly-services/docs/photoshop/guides/photoshop-v2-beta/v1-to-v2/manifest-migration), [format conversion](https://developer.adobe.com/firefly-services/docs/photoshop/guides/photoshop-v2-beta/v1-to-v2/format-conversion-migration) and [document edits](https://developer.adobe.com/firefly-services/docs/photoshop/guides/photoshop-v2-beta/v1-to-v2/document-operations-migration).

## Private configuration

Add this entry under `tools` in the private runtime config, outside Git:

```json
{
  "adobe-photoshop": {
    "enabled": true,
    "allowPaidRequests": true,
    "clientIdFile": "/etc/daftar/secrets/adobe-client-id",
    "clientSecretFile": "/etc/daftar/secrets/adobe-client-secret",
    "assetStorageFile": "/etc/daftar/secrets/adobe-assets.json"
  }
}
```

Each participating project also needs `allowExternalUpload: true`, explicitly allowed `adobe.manifest`/`adobe.render` operations, an employee assignment and current scoped `creative.execute` authority. All credential/config files must be nonsymlink regular files, readable only by their owner (0400/0600), at reviewed absolute paths. Put only the client ID or secret text in the corresponding file; never put credential values in Git, process arguments or editor settings.

`adobe-assets.json` describes an existing private S3-compatible bucket. The runtime neither creates a bucket nor grants itself storage access. A placeholder structure is:

```json
{
  "endpoint": "https://s3.REGION.amazonaws.com",
  "region": "REGION",
  "bucket": "OWNER_BUCKET",
  "accessKeyId": "OWNER_STORAGE_ACCESS_KEY",
  "secretAccessKey": "OWNER_STORAGE_SECRET",
  "prefix": "daftar-creative",
  "virtualHosted": false
}
```

Replace placeholders locally. Temporary credentials can include `sessionToken`. The origin must be HTTPS, with a public DNS name and no path, port, userinfo or query. Use a dedicated prefix and credentials restricted to necessary GET, PUT and DELETE operations. Add a short object lifecycle as a cleanup backstop, accounting for versioning and retention. No bucket-policy changes are made automatically.

## Remote flow and bounds

The adapter checks a bounded regular input file and its format, obtains a token from the fixed Adobe IMS endpoint, and uploads the local bytes under a random transfer prefix. It signs short-lived GET and PUT URLs, submits one v2 job, and polls the fixed status endpoint. Output is downloaded only from its own expected storage key. URLs in a remote status body are not followed. Adobe authentication headers are never sent to object storage; redirects are rejected.

S3 signing follows [AWS's documented SigV4 query-string algorithm](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-query-string-auth.html). The test matches the published reference signature; it does not prove storage credentials, bucket setup or compatibility with every S3-like service.

Outputs use fixed names: `manifest.json`, `render.png` or `render.jpg`. Manifest metadata is structurally bounded and strips external references/credential-like fields. Input and rendered output are limited to 32 MiB; JSON to 4 MiB; dimensions to 16–2048 pixels; each request to 30 seconds; total local waiting to 20 minutes or the stricter runtime limit. Some large professional documents will exceed these deliberate ceilings.

## Durable receipts and uncertain cost

The private `adobe-receipt.json` is atomically persisted and fsynced before paid dispatch and after the remote job ID arrives. It contains operation, input hash, transfer ID, job ID, state and cleanup status, without credentials, signed URLs or private paths. The creative service hashes and retains it even when local work fails, is cancelled or is recovered after restart.

A lost POST acknowledgement is **not retried** automatically. The outcome remains unconfirmed; inspect Adobe account history before creating a new request. Stopping local waiting does not guarantee Adobe stopped a submitted job. Cleanup DELETEs are attempted for known source/output keys, including an upload whose acknowledgement was lost. An unconfirmed upload keeps cleanup pending because a delayed PUT could finish after DELETE. `cleanup: complete` means deletion requests were accepted, the input upload was confirmed (or not attempted), and the Adobe operation is known terminal (or was never submitted); versioned retention and service-side storage may remain. `pending` requires review and the lifecycle backstop.

Native model budgets account for provider usage, not a verified real-time Adobe/storage invoice. `allowPaidRequests` is an explicit opt-in; this module does not invent Adobe pricing or promise a dollar cap. Configure service-side quotas with the account owner if required.

Inventory reports `configured_unverified` and `remoteAuthVerified: false`. A successful job receipt can establish remote authentication for that operation; discovery does not perform a paid authentication check. This change includes **offline mocked Adobe tests only**. No entitled account, bucket or live Photoshop output was available for end-to-end acceptance.

Run `node --test headless-runtime/test/adobe-photoshop.test.mjs` for signing, authentication routing, scoped payloads, secret handling, single dispatch, polling, revocation, cancellation, response limits, output validation and cleanup tests.
