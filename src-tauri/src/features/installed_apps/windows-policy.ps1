# Shared by inventory and uninstall. Compatible with Windows PowerShell 5.1.
# Functions return only explicitly eligible apps; uncertain entries stay hidden.
$ErrorActionPreference = 'Stop'

function Test-DvSystemAppName {
    param([string]$Name, [string]$Publisher)
    if ([string]::IsNullOrWhiteSpace($Name) -or [string]::IsNullOrWhiteSpace($Publisher)) { return $true }
    # Conservatively omit Microsoft-owned packages, even optional Microsoft apps.
    if ($Publisher -match '(?i)Microsoft|Windows|NVIDIA|Advanced Micro Devices|(^|[^A-Za-z])AMD([^A-Za-z]|$)|Intel|Realtek|Synaptics|Qualcomm|Broadcom|MediaTek|DisplayLink') { return $true }
    return $Name -match '(?i)(^|[\s._-])(runtime|redistributable|driver|drivers|update|hotfix|sdk|framework|component|service|webview|directx|firmware|security|defender|system|platform|antivirus|vpn|vulkan|opencl|physx)([\s._-]|$)|visual c\+\+|\.net|windows (sdk|kit)|disk[ -]?vacuum'
}

function Test-DvDesktopApp {
    param($Record)
    if (Test-DvSystemAppName $Record.Name $Record.Publisher) { return $false }
    if ($Record.SystemComponent -ne 0 -or $Record.NoRemove -ne 0 -or $Record.ParentKeyName -or $Record.ReleaseType) { return $false }
    if ([string]::IsNullOrWhiteSpace($Record.UninstallString)) { return $false }
    return $true
}

function Get-DvUninstallPlan {
    param($Record, [string]$Id)
    if (!(Test-DvDesktopApp $Record)) { return $null }
    if ($Record.WindowsInstaller -eq 1) {
        if ($Id -notmatch '^\{[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\}$') { return $null }
        return [pscustomobject]@{ FilePath = (Join-Path $env:SystemRoot 'System32\msiexec.exe'); Arguments = "/x $Id /norestart" }
    }
    if ($Record.WindowsInstaller -ne 0) { return $null }
    $command = [Environment]::ExpandEnvironmentVariables($Record.UninstallString).Trim()
    # Keep arguments as data. Never use Invoke-Expression, cmd /c, or a script host.
    if ($command -match '^"([^"]+\.exe)"\s*(.*)$') {
        $exe = $Matches[1]; $arguments = $Matches[2]
    } elseif ($command -match '^(\S+\.exe)\s*(.*)$') {
        $exe = $Matches[1]; $arguments = $Matches[2]
    } else { return $null }
    # Require an absolute local executable, rejecting UNC/device/relative paths.
    if ($exe -notmatch '^[A-Za-z]:\\' -or $exe.Substring(2) -match '[:/<>|?*"\r\n]' -or $exe -match '(^|\\)\.\.?($|\\)') { return $null }
    # Reject Win32 path aliases (trailing dots/spaces) and empty components.
    foreach ($part in $exe.Substring(3).Split('\')) {
        if (!$part -or $part -match '[. ]$') { return $null }
    }
    $name = [IO.Path]::GetFileName($exe)
    if ($name -match '^(cmd|powershell|pwsh|wscript|cscript|mshta|rundll32|regsvr32|msiexec|reg|schtasks|dism|wusa)\.exe$') { return $null }
    $windows = [IO.Path]::GetFullPath($env:SystemRoot).TrimEnd('\') + '\'
    if ([IO.Path]::GetFullPath($exe).StartsWith($windows, [StringComparison]::OrdinalIgnoreCase)) { return $null }
    return [pscustomobject]@{ FilePath = $exe; Arguments = $arguments }
}

function Test-DvAppxApp {
    param($Package, [System.Collections.Generic.HashSet[string]]$Dependencies)
    if ($null -eq $Package -or $Package.NonRemovable -ne $false -or $Package.IsFramework -ne $false -or $Package.IsResourcePackage -ne $false -or $Package.IsBundle) { return $false }
    if ([string]$Package.SignatureKind -notin @('Store', 'Developer', 'Enterprise') -or [string]$Package.Status -ne 'Ok') { return $false }
    if (Test-DvSystemAppName $Package.Name $Package.Publisher) { return $false }
    if ([string]::IsNullOrWhiteSpace($Package.PackageFullName) -or $Package.PackageFamilyName -notmatch '^[A-Za-z0-9._-]+$') { return $false }
    if ($Dependencies.Contains($Package.PackageFullName) -or $Dependencies.Contains($Package.PackageFamilyName)) { return $false }
    return $true
}

function Test-DvVisibleAppManifest {
    param([xml]$Manifest)
    foreach ($visual in $Manifest.SelectNodes("/*[local-name()='Package']/*[local-name()='Applications']/*[local-name()='Application']/*[local-name()='VisualElements']")) {
        if ($visual.GetAttribute('AppListEntry') -ne 'none' -and $visual.GetAttribute('DisplayName')) { return $true }
    }
    return $false
}

function Get-DvRegistryApps {
    $uninstall = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($scope in @('HKLM64', 'HKLM32', 'HKCU64', 'HKCU32')) {
        $base = $null; $root = $null
        try {
            $hive = if ($scope.StartsWith('HKLM')) { [Microsoft.Win32.RegistryHive]::LocalMachine } else { [Microsoft.Win32.RegistryHive]::CurrentUser }
            $view = if ($scope.EndsWith('64')) { [Microsoft.Win32.RegistryView]::Registry64 } else { [Microsoft.Win32.RegistryView]::Registry32 }
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
            $root = $base.OpenSubKey($uninstall)
            if ($null -eq $root) { continue }
            foreach ($id in $root.GetSubKeyNames()) {
                $entry = $null
                try {
                    $entry = $root.OpenSubKey($id)
                    if ($null -eq $entry -or $id.Contains('\')) { continue }
                    $record = [pscustomobject]@{
                        Name = [string]$entry.GetValue('DisplayName'); Publisher = [string]$entry.GetValue('Publisher')
                        SystemComponent = $entry.GetValue('SystemComponent', 0); NoRemove = $entry.GetValue('NoRemove', 0)
                        ParentKeyName = [string]$entry.GetValue('ParentKeyName'); ReleaseType = [string]$entry.GetValue('ReleaseType')
                        WindowsInstaller = $entry.GetValue('WindowsInstaller', 0); UninstallString = [string]$entry.GetValue('UninstallString')
                    }
                    $plan = Get-DvUninstallPlan $record $id
                    if ($null -eq $plan -or !(Test-Path -LiteralPath $plan.FilePath -PathType Leaf)) { continue }
                    $identity = $scope.Substring(0, 4) + ':' + $id + ':' + $plan.FilePath + ':' + $plan.Arguments
                    if (!$seen.Add($identity)) { continue }
                    $location = [Environment]::ExpandEnvironmentVariables([string]$entry.GetValue('InstallLocation')).Trim().Trim('"')
                    if (!$location -or !(Test-Path -LiteralPath $location -PathType Container)) { $location = $null }
                    # Missing size stays unavailable; malformed/overflowed estimates hide the entry.
                    $size = $entry.GetValue('EstimatedSize')
                    $bytes = if ($null -ne $size -and [long]$size -gt 0) { [long]$size * 1024 } else { $null }
                    [pscustomobject]@{
                        Key = "winreg:${scope}:$id"; Name = $record.Name; Source = "Windows desktop ($scope)"
                        InstalledBytes = $bytes; InstallationPath = $location; CachePath = $null
                        Plan = $plan; Scope = $scope
                    }
                } catch {
                    # Malformed or inaccessible registrations are not removal candidates.
                    continue
                } finally { if ($entry) { $entry.Dispose() } }
            }
        } catch {
            continue
        } finally { if ($root) { $root.Dispose() }; if ($base) { $base.Dispose() } }
    }
}

function Get-DvAppxApps {
    # Current user only. Never enumerate/remove packages for other users.
    $packages = @(Get-AppxPackage -ErrorAction Stop)
    $dependencies = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($package in $packages) {
        foreach ($dependency in $package.Dependencies) {
            if ($dependency.PackageFullName) { [void]$dependencies.Add($dependency.PackageFullName) }
            if ($dependency.PackageFamilyName) { [void]$dependencies.Add($dependency.PackageFamilyName) }
        }
    }
    foreach ($package in $packages) {
        if (!(Test-DvAppxApp $package $dependencies)) { continue }
        try {
            $manifest = Get-AppxPackageManifest -Package $package.PackageFullName -ErrorAction Stop
            if (!(Test-DvVisibleAppManifest $manifest)) { continue }
            $location = $package.InstallLocation
            if (!$location -or !(Test-Path -LiteralPath $location -PathType Container)) { continue }
            $cache = Join-Path (Join-Path (Join-Path $env:LOCALAPPDATA 'Packages') $package.PackageFamilyName) 'LocalCache'
            if (!(Test-Path -LiteralPath $cache -PathType Container)) { $cache = $null }
            [pscustomobject]@{
                Key = "appx:$($package.PackageFullName)"; Name = $package.Name; Source = 'Windows Store / MSIX'
                InstalledBytes = $null; InstallationPath = $location; CachePath = $cache; Package = $package
            }
        } catch { continue }
    }
}
