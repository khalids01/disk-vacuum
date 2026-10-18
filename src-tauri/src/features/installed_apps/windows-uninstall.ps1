# windows-policy.ps1 is prepended by the Rust host.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$key = $env:DISKVACUUM_APP_KEY
if ([string]::IsNullOrWhiteSpace($key)) { throw 'Application identifier is missing.' }
if ($key.StartsWith('appx:', [StringComparison]::Ordinal)) {
    # Re-enumerate dependencies, system flags, and manifest immediately before removal.
    $eligible = @(Get-DvAppxApps | Where-Object { $_.Key -ceq $key })
    if ($eligible.Count -ne 1) { throw 'Application is no longer eligible for removal. Refresh the list.' }
    Remove-AppxPackage -Package $eligible[0].Package.PackageFullName -ErrorAction Stop
} elseif ($key.StartsWith('winreg:', [StringComparison]::Ordinal)) {
    # Only use an uninstall plan read from a currently eligible registry entry.
    $eligible = @(Get-DvRegistryApps | Where-Object { $_.Key -ceq $key })
    if ($eligible.Count -ne 1) { throw 'Application is no longer eligible for removal. Refresh the list.' }
    $app = $eligible[0]
    $options = @{ FilePath = $app.Plan.FilePath; PassThru = $true; Wait = $true; ErrorAction = 'Stop' }
    if ($app.Plan.Arguments) { $options.ArgumentList = $app.Plan.Arguments }
    if ($app.Scope.StartsWith('HKLM')) { $options.Verb = 'RunAs' }
    $process = Start-Process @options
    if ($null -eq $process.ExitCode -or $process.ExitCode -notin @(0, 1641, 3010)) {
        throw "Uninstaller did not complete successfully (exit code $($process.ExitCode))."
    }
} else { throw 'Unsupported application identifier.' }
