# Non-destructive policy, command-construction, and Windows PowerShell parser checks.
param([switch]$Portable)
$ErrorActionPreference = 'Stop'
$directory = Join-Path $PSScriptRoot '../src-tauri/src/features/installed_apps'
$policy = Join-Path $directory 'windows-policy.ps1'
foreach ($file in @('windows-policy.ps1', 'windows-inventory.ps1', 'windows-uninstall.ps1')) {
    $tokens = $null; $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $directory $file), [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw "Invalid PowerShell in ${file}: $($errors -join '; ')" }
}
foreach ($file in @('windows-inventory.ps1', 'windows-uninstall.ps1')) {
    $script = (Get-Content -LiteralPath $policy -Raw) + "`ntry {`n" + (Get-Content -LiteralPath (Join-Path $directory $file) -Raw) + "`n" + '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }'
    $tokens = $null; $errors = $null
    [void][Management.Automation.Language.Parser]::ParseInput($script, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw "Invalid combined script ${file}: $($errors -join '; ')" }
    if ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script)).Length + 1024 -ge 32767) {
        throw "Encoded script exceeds the Windows process command-line limit: $file"
    }
}
. $policy
$script:checks = 0
function Assert-Dv {
    param([bool]$Condition, [string]$Message)
    if (!$Condition) { throw "Windows Installed Apps check failed: $Message" }
    $script:checks++
}
function New-DvDesktopRecord {
    param([hashtable]$Override = @{})
    $record = @{
        Name = 'Example Editor'; Publisher = 'Example Software'
        SystemComponent = 0; NoRemove = 0; ParentKeyName = ''; ReleaseType = ''
        WindowsInstaller = 0; UninstallString = '"C:\Program Files\Example\uninstall.exe" /uninstall "quoted argument"'
    }
    foreach ($key in $Override.Keys) { $record[$key] = $Override[$key] }
    return [pscustomobject]$record
}
function New-DvAppxRecord {
    param([hashtable]$Override = @{})
    $record = @{
        Name = 'Example.Editor'; Publisher = 'CN=Example Software'
        NonRemovable = $false; IsFramework = $false; IsResourcePackage = $false; IsBundle = $false
        SignatureKind = 'Store'; Status = 'Ok'; PackageFullName = 'Example.Editor_1.0.0.0_x64__example123'
        PackageFamilyName = 'Example.Editor_example123'
    }
    foreach ($key in $Override.Keys) { $record[$key] = $Override[$key] }
    return [pscustomobject]$record
}

Assert-Dv (Test-DvDesktopApp (New-DvDesktopRecord)) 'ordinary third-party desktop app is eligible'
foreach ($override in @(
    @{ SystemComponent = 1 }, @{ NoRemove = 1 }, @{ ParentKeyName = 'ParentApp' }, @{ ReleaseType = 'Security Update' },
    @{ Publisher = 'Microsoft Corporation' }, @{ Name = 'AMD Software'; Publisher = 'Advanced Micro Devices, Inc.' }, @{ Name = 'NVIDIA Graphics'; Publisher = 'NVIDIA Corporation' }, @{ Publisher = '' }, @{ Name = 'Graphics Driver' },
    @{ Name = 'Vendor Runtime' }, @{ Name = 'Example Redistributable' }, @{ Name = 'Example SDK' },
    @{ Name = 'Vendor Firmware' }, @{ Name = 'Windows Security' }, @{ Name = 'DiskVacuum' }, @{ UninstallString = '' }
)) {
    $record = New-DvDesktopRecord $override
    Assert-Dv (!(Test-DvDesktopApp $record)) ('hide protected/component desktop registration: ' + ($override | Out-String))
    Assert-Dv ($null -eq (Get-DvUninstallPlan $record 'example')) 'uninstall policy also rejects hidden registration'
}
if (!$Portable) {
$plan = Get-DvUninstallPlan (New-DvDesktopRecord) 'example'
Assert-Dv ($plan.FilePath -ceq 'C:\Program Files\Example\uninstall.exe') 'quoted executable keeps spaces'
Assert-Dv ($plan.Arguments -ceq '/uninstall "quoted argument"') 'vendor argument quoting is preserved as data'
$plan = Get-DvUninstallPlan (New-DvDesktopRecord @{ UninstallString = 'C:\Apps\uninstall.exe /remove' }) 'example'
Assert-Dv ($plan.FilePath -ceq 'C:\Apps\uninstall.exe') 'absolute unquoted executable without spaces is supported'
foreach ($command in @(
    'C:\Program Files\Example\uninstall.exe /remove', 'uninstall.exe /remove', '\\server\share\uninstall.exe',
    '"C:\Apps\..\Windows\tool.exe" /remove', '"C:\Apps\cmd.exe" /c anything', '"C:\Apps\rundll32.exe" anything',
    '"C:\Apps\powershell.exe" -Command anything', '"C:\Apps\wscript.exe" anything', '"C:\Apps\msiexec.exe" /x anything',
    '"C:\Apps\uninstall.ps1"', '"C:\Windows.\tool.exe"', '"C:\Apps\uninstall.exe:stream.exe"', '"C:\Apps/../Windows/tool.exe"', ('"' + $env:SystemRoot + '\System32\dism.exe" /remove')
)) {
    Assert-Dv ($null -eq (Get-DvUninstallPlan (New-DvDesktopRecord @{ UninstallString = $command }) 'example')) "unsafe/ambiguous command is rejected: $command"
}
$guid = '{12345678-1234-1234-1234-123456789ABC}'
$plan = Get-DvUninstallPlan (New-DvDesktopRecord @{ WindowsInstaller = 1 }) $guid
Assert-Dv ($plan.FilePath -ieq (Join-Path $env:SystemRoot 'System32\msiexec.exe')) 'MSI uses the OS executable'
Assert-Dv ($plan.Arguments -ceq "/x $guid /norestart") 'MSI removes only validated product and suppresses restart'
Assert-Dv ($null -eq (Get-DvUninstallPlan (New-DvDesktopRecord @{ WindowsInstaller = 1 }) '{not-a-guid}')) 'invalid MSI product is rejected'
Assert-Dv ($null -eq (Get-DvUninstallPlan (New-DvDesktopRecord @{ WindowsInstaller = 2 }) $guid)) 'unknown installer metadata is rejected'

} else {
    Write-Output 'Portable check: native Windows path/installer cases run in Windows release CI.'
}

$dependencies = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
Assert-Dv (Test-DvAppxApp (New-DvAppxRecord) $dependencies) 'ordinary Store app is eligible'
foreach ($override in @(
    @{ NonRemovable = $true }, @{ NonRemovable = $null }, @{ IsFramework = $true }, @{ IsResourcePackage = $true },
    @{ IsBundle = $true }, @{ SignatureKind = 'System' }, @{ Status = 'Modified' }, @{ Publisher = 'CN=Microsoft Corporation' },
    @{ Name = 'Microsoft.Windows.ShellExperienceHost'; Publisher = 'CN=Microsoft Windows' },
    @{ PackageFamilyName = '..\OtherApp' }, @{ PackageFullName = '' }
)) {
    Assert-Dv (!(Test-DvAppxApp (New-DvAppxRecord $override) $dependencies)) 'system/unknown package is rejected'
}
[void]$dependencies.Add('Example.Editor_1.0.0.0_x64__example123')
Assert-Dv (!(Test-DvAppxApp (New-DvAppxRecord) $dependencies)) 'installed package dependencies are protected'
$dependencies.Clear()
[void]$dependencies.Add('Example.Editor_example123')
Assert-Dv (!(Test-DvAppxApp (New-DvAppxRecord) $dependencies)) 'dependency family names are protected'

Assert-Dv (Test-DvVisibleAppManifest ([xml]'<Package xmlns:uap="urn:example"><Applications><Application><uap:VisualElements DisplayName="Example" /></Application></Applications></Package>')) 'visible namespaced app manifest is supported'
Assert-Dv (!(Test-DvVisibleAppManifest ([xml]'<Package><Applications><Application><VisualElements DisplayName="Hidden" AppListEntry="none" /></Application></Applications></Package>'))) 'background-only package is hidden'
Assert-Dv (!(Test-DvVisibleAppManifest ([xml]'<Package><Applications /></Package>'))) 'manifest without visible apps is hidden'
# Exercise the real entry scripts against in-memory fixtures. These mocks never
# read the registry, invoke package managers, or launch a process.
$inventoryScript = [scriptblock]::Create((Get-Content -LiteralPath (Join-Path $directory 'windows-inventory.ps1') -Raw))
$uninstallScript = [scriptblock]::Create((Get-Content -LiteralPath (Join-Path $directory 'windows-uninstall.ps1') -Raw))
$script:registryFixtures = @(); $script:appxFixtures = @()
$script:processExitCode = 0; $script:launched = $null; $script:removedPackage = $null
function Get-DvRegistryApps { $script:registryFixtures }
function Get-DvAppxApps { $script:appxFixtures }
function Start-Process {
    [CmdletBinding()]
    param([string]$FilePath, [string]$ArgumentList, [switch]$PassThru, [switch]$Wait, [string]$Verb)
    $script:launched = [pscustomobject]@{ FilePath = $FilePath; Arguments = $ArgumentList; Wait = $Wait.IsPresent; Verb = $Verb }
    return [pscustomobject]@{ ExitCode = $script:processExitCode }
}
function Remove-AppxPackage {
    [CmdletBinding()]
    param([string]$Package)
    $script:removedPackage = $Package
}
function Assert-DvThrows {
    param([scriptblock]$Action, [string]$Message)
    $threw = $false
    try { & $Action } catch { $threw = $true }
    Assert-Dv $threw $Message
}
$emptyJson = & $inventoryScript
Assert-Dv ($emptyJson -ceq '[]') 'zero inventory entries serialize as an array'
$script:registryFixtures = @([pscustomobject]@{
    Key = 'winreg:HKCU64:example'; Name = 'Example Editor'; Source = 'Windows desktop (HKCU64)'
    InstalledBytes = 1024; InstallationPath = 'C:\Apps\Example'; CachePath = $null
    Plan = [pscustomobject]@{ FilePath = 'C:\Apps\Example\uninstall.exe'; Arguments = '/uninstall "quoted argument"' }
    Scope = 'HKCU64'
})
$singleJson = & $inventoryScript
Assert-Dv ($singleJson.TrimStart().StartsWith('[')) 'single inventory entry remains an array'
$single = @($singleJson | ConvertFrom-Json)
Assert-Dv ($single.Count -eq 1 -and $single[0].key -ceq 'winreg:HKCU64:example') 'inventory key reaches the frontend unchanged'
Assert-Dv ($single[0].installedBytes -eq 1024 -and $null -eq $single[0].cacheBytes) 'known storage and unknown cache stay distinct'
Assert-Dv ($null -eq $single[0].PSObject.Properties['Plan']) 'internal uninstall plans are not exposed to the frontend'
$originalKey = $env:DISKVACUUM_APP_KEY
try {
    $env:DISKVACUUM_APP_KEY = 'winreg:HKCU64:example'
    & $uninstallScript
    Assert-Dv ($script:launched.FilePath -ceq 'C:\Apps\Example\uninstall.exe') 'only the eligible registry uninstaller is launched'
    Assert-Dv ($script:launched.Arguments -ceq '/uninstall "quoted argument"' -and $script:launched.Wait) 'uninstaller arguments and waiting are preserved'
    Assert-Dv (!$script:launched.Verb) 'per-user uninstall does not force administrator elevation'
    $script:registryFixtures[0].Key = 'winreg:HKLM64:example'; $script:registryFixtures[0].Scope = 'HKLM64'
    $env:DISKVACUUM_APP_KEY = 'winreg:HKLM64:example'
    & $uninstallScript
    Assert-Dv ($script:launched.Verb -ceq 'RunAs') 'system registration uses the native administrator prompt'
    $script:processExitCode = 1602
    Assert-DvThrows { & $uninstallScript } 'cancelled/failed uninstall is reported as an error'
    $script:processExitCode = 3010
    & $uninstallScript
    Assert-Dv ($script:launched.Wait) 'successful reboot-required uninstall is accepted'
    $script:processExitCode = 0
    $script:registryFixtures = @(); $script:launched = $null
    Assert-DvThrows { & $uninstallScript } 'stale or newly protected app is rejected on re-enumeration'
    Assert-Dv ($null -eq $script:launched) 'rejected app does not launch any process'
    $env:DISKVACUUM_APP_KEY = 'winreg:HKLM64:example"; throw "injection'
    Assert-DvThrows { & $uninstallScript } 'unknown identifiers are data, not evaluated code'
    $script:appxFixtures = @([pscustomobject]@{
        Key = 'appx:Example.Editor_1.0.0.0_x64__example123'; Name = 'Example.Editor'; Source = 'Windows Store / MSIX'
        InstalledBytes = $null; InstallationPath = 'C:\Apps\Example'; CachePath = 'C:\Users\Example\LocalCache'
        Package = [pscustomobject]@{ PackageFullName = 'Example.Editor_1.0.0.0_x64__example123' }
    })
    $env:DISKVACUUM_APP_KEY = 'appx:Example.Editor_1.0.0.0_x64__example123'
    & $uninstallScript
    Assert-Dv ($script:removedPackage -ceq 'Example.Editor_1.0.0.0_x64__example123') 'only the exact current-user package is removed'
    $script:appxFixtures = @(); $script:removedPackage = $null
    Assert-DvThrows { & $uninstallScript } 'protected or dependency package is rejected after re-enumeration'
    Assert-Dv ($null -eq $script:removedPackage) 'rejected package is never removed'
} finally {
    if ($null -eq $originalKey) { Remove-Item Env:DISKVACUUM_APP_KEY -ErrorAction SilentlyContinue }
    else { $env:DISKVACUUM_APP_KEY = $originalKey }
}
Write-Output "Windows Installed Apps: $script:checks non-destructive checks passed."
