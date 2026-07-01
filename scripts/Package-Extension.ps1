$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$extensionRoot = Join-Path $projectRoot 'extension'
$artifactRoot = Join-Path $projectRoot 'artifacts'
$stagingRoot = Join-Path $artifactRoot 'extension-package'
$zipPath = Join-Path $artifactRoot 'werbl-extension.zip'
$manifestPath = Join-Path $extensionRoot 'manifest.json'
$runtimeEntries = @(
  'manifest.json',
  'background.js',
  'offscreen.html',
  'offscreen.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons'
)

if (-not (Test-Path -LiteralPath $extensionRoot -PathType Container)) {
  throw "Extension folder was not found: $extensionRoot"
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Extension manifest was not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($manifest.name)) {
  throw "Extension manifest is missing a name: $manifestPath"
}

if ([string]::IsNullOrWhiteSpace($manifest.version)) {
  throw "Extension manifest is missing a version: $manifestPath"
}

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

foreach ($stalePackage in Get-ChildItem -LiteralPath $artifactRoot -File -Filter '*-extension.zip') {
  Remove-Item -LiteralPath $stalePackage.FullName -Force
  Write-Output "Removed stale package $($stalePackage.FullName)"
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

try {
  foreach ($entry in $runtimeEntries) {
    $sourcePath = Join-Path $extensionRoot $entry
    $targetPath = Join-Path $stagingRoot $entry

    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Runtime extension entry was not found: $sourcePath"
    }

    if ((Get-Item -LiteralPath $sourcePath) -is [System.IO.DirectoryInfo]) {
      Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse
    } else {
      Copy-Item -LiteralPath $sourcePath -Destination $targetPath
    }
  }

  Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output "Created $zipPath for $($manifest.name) $($manifest.version)"
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}
