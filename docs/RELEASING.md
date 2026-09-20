# Desktop signing and releases

Hydian distributes a Windows installer and macOS disk images. Operating-system signing identifies the publisher; the separate Tauri updater key protects automatic updates. Keep the existing updater key: replacing it without a migration prevents installed copies from accepting updates.

## Release flow

Prepare a release on a pull-request branch with `node scripts/bump.mjs patch` (or `minor` / `major`). Commit all four changed version files and merge the reviewed PR after CI passes. Changes to these files on `main`, or a manual **Release** run on `main`, follow these steps:

1. Run the shared type, lint, format, test and frontend-build checks.
2. Check that all four version files agree and tag the exact merged commit. Compile Windows x64, macOS Apple Silicon and macOS Intel without signing credentials. Release automation never commits or pushes to `main`.
3. Wait for approval in the GitHub `release` environment. Fresh runners restore the compiled files, install dependencies without lifecycle scripts, and bundle them without rebuilding or running bundle hooks.
4. Sign and verify each platform. Upload to a GitHub **draft** release. Signing jobs run sequentially because the Tauri action merges one updater manifest.
5. Require all platform jobs to pass and approval in the `downloads` environment. Check the manifest, required assets and updater signatures against the public key in the reviewed configuration before publishing GitHub and the download bucket.

A missing credential or failed verification blocks publication. Local and pull-request builds can remain unsigned/ad-hoc. A dependency-only push with an already tagged version skips the release; manual runs reject a version tagged at another commit. Failed runs may leave a tag and draft assets. Fix the configuration and rerun failed jobs in that same run; retries accept a tag only when it still identifies that run's commit. If fixing source code requires another commit, bump the version in a new PR.

Published GitHub releases are immutable. After publication, retry only a failed download-publication job; rebuilding or signing again cannot replace published assets. The download-publication workflow has no independent manual bypass.

## GitHub configuration

Create a `release` environment with a required maintainer reviewer and a deployment-branch rule allowing only `main`. Allow self-review if the project has one maintainer. Review the workflow and scripts at the proposed release before approving it.

Protect `main` with required pull requests, passing CI checks and resolved conversations; block force-pushes and deletion. No release-bot branch-protection bypass is needed. Create `downloads` and `website` environments restricted to `main`, with a required maintainer reviewer, for the corresponding publishing jobs.

Put the following values in **environment secrets**, not repository-wide secrets:

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Existing Hydian updater private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password, if encrypted |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application `.p12`, including its private key |
| `APPLE_CERTIFICATE_PASSWORD` | Export password |
| `APPLE_SIGNING_IDENTITY` | Full `Developer ID Application: …` identity |
| `APPLE_API_ISSUER` | App Store Connect team issuer ID |
| `APPLE_API_KEY` | Dedicated notarization API key ID |
| `APPLE_API_PRIVATE_KEY` | Contents of its private `.p8` file |
| `APPLE_TEAM_ID` | Developer team ID |
| `AZURE_CLIENT_ID` | Entra application's client ID |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_SIGNING_ENDPOINT` | Regional signing endpoint shown by Azure |
| `AZURE_SIGNING_ACCOUNT` | Artifact Signing account name |
| `AZURE_SIGNING_PROFILE` | Public Trust certificate-profile name |
| `WINDOWS_SIGNING_SUBJECT` | Exact certificate Subject from the validated profile |

Store `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ACCOUNT_ID` in the `downloads` environment. Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `website`. Remove their repository-level copies after saving and checking the environment replacements; environment protection does not restrict copies held at repository scope. Pull-request workflows must not receive production credentials, even when the PR comes from a branch in this repository.

Actions are pinned to commits. Credentials are scoped to the steps that need them, checkout credentials are not retained on build/signing runners, and Azure uses short-lived GitHub OIDC tokens. Identifiers are stored as secrets to mask them in ordinary logs. Keep debug tracing and environment dumps disabled. GitHub masking is a precaution, not a boundary against malicious approved workflow code; maintainers and release dependencies remain trusted.

## Apple setup

Use an Apple Developer Program organization membership authorized to distribute Hydian. Use its **Developer ID Application** certificate and private key, with a dedicated App Store Connect **team API key** using the **Developer** role for notarization. Apple team keys cover all apps in the team; use a dedicated key for this repository so its use can be audited and revoked separately. The workflow writes its private key to an owner-only temporary file and removes it after bundling. Tauri signs, notarizes and staples the app, then creates and signs the DMG. The workflow verifies the app signature, expected team, stapled ticket and Gatekeeper assessment, plus the DMG signature.

The publisher's organization name and team identifier are visible in signed software. An individual membership identifies the individual. Apple Developer Program membership is normally US$99/year or local equivalent, shared across the team's apps.

References: [Apple membership](https://developer.apple.com/support/compare-memberships/), [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Azure setup

Artifact Signing **Basic** costs US$9.99/month per signing account for 5,000 signatures, then US$0.005 per additional signature, before applicable tax/currency conversion. A release consumes several signatures, including the app, installer, uninstaller and installer plugins. Microsoft 365 provides an identity directory; an Azure subscription and signing account are separate. This setup needs no VM, storage account or paid support plan.

1. Use an Azure subscription in the intended publisher's directory. Create one Basic Artifact Signing account in a supported region and complete organization identity validation. Create a **Public Trust** certificate profile. EU organizations are eligible; individual eligibility is currently limited to the US and Canada.
2. Register an Entra application for Hydian releases. Add a GitHub federated credential with issuer `https://token.actions.githubusercontent.com` and audience `api://AzureADTokenExchange`. Read the exact subject with `gh api repos/SithCult/hydian/actions/oidc/customization/sub --jq '.sub_claim_prefix + ":environment:release"'`; use that result rather than a name-only subject because this repository uses immutable owner and repository IDs.
3. Grant that identity **Artifact Signing Certificate Profile Signer** on this certificate profile only. No client password or subscription-wide Contributor role is needed for CI.
4. Save the Azure values above in GitHub's `release` environment. Copy the exact verified certificate Subject for `WINDOWS_SIGNING_SUBJECT`.
5. Configure a budget alert for the dedicated signing resource. Azure budget alerts notify; they do not cap charges.

One account/profile can sign multiple apps under the same publisher and share its monthly allowance. Give each repository its own federated CI identity.

The release uses `azure/login` for OIDC and Microsoft's `ArtifactSigning` PowerShell module, pinned to the version used by Microsoft's action. Tauri's signing hook signs and verifies each file before updater signatures are generated. A failure marker also catches uninstaller-signing errors that NSIS may otherwise ignore. The completed app and installer must have valid signatures, timestamps and the expected publisher.

The verified certificate identity, including the company name and certificate subject details, is public. Azure client, subscription and tenant IDs are not signing credentials, but we keep them out of normal logs. Signing does not guarantee immediate Windows SmartScreen reputation.

References: [pricing](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-change-sku), [setup and eligibility](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [Azure GitHub OIDC setup](https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md), [GitHub OIDC subjects](https://docs.github.com/en/actions/reference/security/oidc), [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/), [SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## First signed release

CI checks do not replace a real installation test. Download the final files through a browser onto clean Windows, Apple Silicon and Intel systems. Keep macOS quarantine intact. Test installation, first launch, offline launch, an update from the previous installed version, restart and uninstall. Record the OS versions and results before describing a release as verified.

Production Hydian checks for updates about 15 seconds after startup and every six hours, downloads an available update and offers a restart. Manual checking is under **Settings → About**. The browser preview has no updater; development builds skip update checks.

Provider documentation and pricing checked on 2026-09-19. Signing-account provisioning and a successful hosted release must be verified separately from these local workflow changes.
