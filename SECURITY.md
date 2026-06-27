# Security Policy

## Reporting a vulnerability

**Do not open a public issue for security problems.** Report privately so a fix can ship before
details are public:

- Preferred: GitHub's **private vulnerability reporting** — repo **Security → Report a vulnerability**
  (Settings → Code security → Private vulnerability reporting must be enabled).
- Or email **support@ascentspark.com** with steps to reproduce, affected version(s), and impact.

We aim to acknowledge within **2 business days** and to provide a remediation timeline after triage.
Please give us a reasonable window to release a fix before any public disclosure.

## Supported versions

Security fixes are provided for the latest release of each supported Angular line:

| Version | Angular | Supported |
|---------|---------|-----------|
| `22.x`  | 22      | ✅ |
| `21.x`  | 21      | ✅ |
| `20.x`  | 20      | ✅ |
| < these | —       | ❌ |

Once 1.0 ships, this table will track the supported major lines.

## Scope & trust boundary

`@ascentsparksoftware/angular-image-editor` is a client-side library; runtime security ultimately
depends on how the consuming app uses it.

- **Untrusted images / SVGs.** The editor loads consumer-supplied image and SVG data onto an HTML
  canvas. SVGs are rasterized through a sandboxed `<img>` element (scripts in SVG do **not** execute),
  but you should still treat user-uploaded files as untrusted: validate type and size at your upload
  boundary, and serve user content from a separate origin where feasible. Exported blobs/PDFs reflect
  exactly what was drawn — sanitize any text overlaid from untrusted sources in your own app.
- **Optional AI background removal.** The `removeBackground` / `cutOutSubject` tools lazy-load
  `@imgly/background-removal`, which fetches an ONNX model **at runtime** from a CDN and runs it
  in-browser. No image data leaves the browser, but the model download is a network dependency — pin
  or self-host it if your threat model requires it. These deps are `optionalDependencies`; if you
  don't install them, the AI tools are simply unavailable.

## What is not a vulnerability

- Issues requiring a malicious local environment or a compromised build toolchain.
- Advisories in **devDependencies / build tooling** that never ship to consumers. Runtime deps that
  ship are limited to the package's declared `dependencies` / `peerDependencies`.
