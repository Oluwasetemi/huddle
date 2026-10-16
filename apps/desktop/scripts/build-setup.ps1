param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [ValidateSet("x64")]
    [string]$Arch = "x64",
    [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-WorkspaceVersion {
    param([string]$CargoTomlPath)
    $inWorkspacePackage = $false
    foreach ($line in Get-Content $CargoTomlPath) {
        if ($line -match '^\s*\[workspace\.package\]\s*$') {
            $inWorkspacePackage = $true
            continue
        }
        if ($inWorkspacePackage -and $line -match '^\s*\[') { break }
        if ($inWorkspacePackage -and $line -match '^\s*version\s*=\s*"([^"]+)"\s*$') {
            return $Matches[1]
        }
    }
    throw "Could not read workspace version from $CargoTomlPath"
}

function Resolve-IsccPath {
    $command = Get-Command iscc -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    throw "ISCC.exe not found. Install Inno Setup 6."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$cargoToml = Join-Path $repoRoot "Cargo.toml"
$issPath = Join-Path $repoRoot "packaging\windows\huddle.iss"
$originalVersion = $Version
$packageVersion = $Version -replace '^v', ''
if ($packageVersion -notmatch '^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$') {
    throw "Release tag must be SemVer, optionally prefixed by v."
}
$cargoVersion = Get-WorkspaceVersion -CargoTomlPath $cargoToml
if ($packageVersion -ne $cargoVersion) {
    throw "Release version $packageVersion does not match Cargo workspace version $cargoVersion."
}
if ($Target -ne "x86_64-pc-windows-msvc") {
    throw "Only x86_64-pc-windows-msvc is currently packaged."
}

Push-Location $repoRoot
try {
    & cargo build --release --locked --target $Target -p huddle-desktop
    if ($LASTEXITCODE -ne 0) { throw "cargo build failed with exit code $LASTEXITCODE" }

    $exePath = Join-Path $repoRoot "target\$Target\release\huddle-desktop.exe"
    if (-not (Test-Path $exePath)) { throw "Expected binary not found at $exePath" }

    $iscc = Resolve-IsccPath
    & $iscc `
        "/DMyAppVersion=$packageVersion" `
        "/DMyOriginalVersion=$originalVersion" `
        "/DMyArch=$Arch" `
        "/DMyTarget=$Target" `
        "/DMyRepoRoot=$repoRoot" `
        $issPath
    if ($LASTEXITCODE -ne 0) { throw "ISCC failed with exit code $LASTEXITCODE" }

    $output = Join-Path $repoRoot "target\dist\Huddle-$originalVersion-windows-$Arch-Setup.exe"
    if (-not (Test-Path $output)) { throw "Expected installer not found at $output" }
    Write-Host "Created $output"
}
finally {
    Pop-Location
}
