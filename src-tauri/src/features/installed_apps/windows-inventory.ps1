# windows-policy.ps1 is prepended by the Rust host.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$rows = [System.Collections.Generic.List[object]]::new()
$apps = @(Get-DvRegistryApps) + @(Get-DvAppxApps)
foreach ($app in $apps) {
    $rows.Add(@{
        key = $app.Key; name = $app.Name; source = $app.Source
        installedBytes = $app.InstalledBytes; installationPath = $app.InstallationPath
        cacheBytes = $null; cachePath = $app.CachePath; uninstallAvailable = $true
    })
}
ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 4 -Compress
