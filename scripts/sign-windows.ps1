param([Parameter(Mandatory)][string]$Path)

$ErrorActionPreference = 'Stop'
try {
    Import-Module ArtifactSigning -RequiredVersion 0.1.8

    # Use the short-lived Azure CLI login established by GitHub OIDC.
    Invoke-ArtifactSigning `
        -Endpoint $env:AZURE_SIGNING_ENDPOINT `
        -CodeSigningAccountName $env:AZURE_SIGNING_ACCOUNT `
        -CertificateProfileName $env:AZURE_SIGNING_PROFILE `
        -Files (Resolve-Path -LiteralPath $Path).Path `
        -FileDigest SHA256 `
        -TimestampRfc3161 'http://timestamp.acs.microsoft.com' `
        -TimestampDigest SHA256 `
        -ExcludeEnvironmentCredential `
        -ExcludeWorkloadIdentityCredential `
        -ExcludeManagedIdentityCredential `
        -ExcludeSharedTokenCacheCredential `
        -ExcludeVisualStudioCredential `
        -ExcludeVisualStudioCodeCredential `
        -ExcludeAzurePowerShellCredential `
        -ExcludeAzureDeveloperCliCredential `
        -ExcludeInteractiveBrowserCredential

    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne 'Valid' -or !$signature.TimeStamperCertificate -or $signature.SignerCertificate.Subject -ne $env:WINDOWS_SIGNING_SUBJECT) {
        throw 'Windows signature is invalid, untimestamped or from an unexpected publisher.'
    }
} catch {
    Set-Content -LiteralPath $env:HYDIAN_SIGNING_FAILURE_FILE -Value 'failed'
    throw
}
