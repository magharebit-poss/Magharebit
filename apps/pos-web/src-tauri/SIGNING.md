# Windows Installer Code Signing

This documents how the Magharebit POS Windows installer is code-signed.

> **Status: SELF-SIGNED.** The current setup uses a free, self-signed
> certificate. Windows SmartScreen will still show an **"Unknown Publisher"**
> warning on end-user machines — that is expected. This phase establishes the
> signing *pipeline*, not trusted-publisher status. See
> [Upgrading to a commercial certificate](#upgrading-to-a-commercial-certificate).

All signing material (certificates, keys, passwords, and the machine-specific
config overlay) is **gitignored and never committed**. Nothing secret lives in
the repository.

---

## 1. Generate the self-signed certificate (one-time, per build machine)

In PowerShell:

```powershell
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Magharebit, O=Magharebit, C=MA" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(3)

# Public identifier of the cert — you will need this for step 3.
$cert.Thumbprint
```

Record the printed thumbprint (a 40-character hex string). It is a public
identifier, not a secret, but it is specific to this machine's certificate.

## 2. (Optional) Export the certificate to a PFX

A PFX export is useful for backup or for moving the cert to a CI machine. The
PFX password is read from an environment variable — **never hardcode it**.

```powershell
# Set the password in your shell first (do NOT commit it anywhere):
$env:TAURI_SIGN_PFX_PASSWORD = "<your-strong-password>"

$pwd = ConvertTo-SecureString -String $env:TAURI_SIGN_PFX_PASSWORD -Force -AsPlainText
Export-PfxCertificate `
  -Cert "Cert:\CurrentUser\My\<YOUR_THUMBPRINT>" `
  -FilePath "src-tauri\certs\magharebit-selfsigned.pfx" `
  -Password $pwd
```

The `src-tauri/certs/` directory and all `*.pfx` files are gitignored.

## 3. Configure the build with your thumbprint

The committed `tauri.conf.json` ships with `certificateThumbprint: null` (no
machine-specific value in source). The real thumbprint goes in a Windows-only
overlay that Tauri auto-merges on Windows builds:

```powershell
copy src-tauri\tauri.windows.conf.json.example src-tauri\tauri.windows.conf.json
```

Then edit `src-tauri/tauri.windows.conf.json` and replace
`REPLACE_WITH_THUMBPRINT` with the thumbprint from step 1.

`tauri.windows.conf.json` is **gitignored** — only the `.example` template is
committed.

## 4. Required environment variables

| Variable | Purpose | Required when |
| --- | --- | --- |
| `TAURI_SIGN_PFX_PASSWORD` | Password used to export/import the PFX | Only for the optional PFX export in step 2 |

(Signing via the certificate store in step 3 does not require a password at
build time — Windows uses the cert already installed in `Cert:\CurrentUser\My`.)

## 5. Build the signed installer

```powershell
cd apps/pos-web
npx tauri build
```

Tauri runs `npm run build:tauri` (static export to `out/`), compiles the Rust
bundle, then signs the installer using the thumbprint from
`tauri.windows.conf.json` with SHA-256 and an RFC 3161 timestamp.

## 6. Output location

Signed artifacts land in:

```
src-tauri/target/release/bundle/
```

(e.g. the `.msi` and/or NSIS `.exe` installers).

---

## Upgrading to a commercial certificate

Moving to a trusted Authenticode certificate (to remove the SmartScreen
"Unknown Publisher" warning) is a **config-only** change — no code changes:

1. Purchase a code-signing certificate from a CA (e.g. DigiCert, Sectigo) and
   install it into `Cert:\CurrentUser\My` (or import the provided PFX).
2. Replace the thumbprint in `tauri.windows.conf.json` with the commercial
   cert's thumbprint.
3. Rebuild. That's it — `digestAlgorithm` and `timestampUrl` stay the same.

The signing pipeline (config overlay + cert-store approach) is identical for
self-signed and commercial certs.
