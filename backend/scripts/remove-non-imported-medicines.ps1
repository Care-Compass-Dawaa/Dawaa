param(
  [string] $TableName = "DawaaMedicines",
  [switch] $Apply
)

$ErrorActionPreference = "Stop"
$workDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir = Join-Path $workDir "..\data\processed"
$scanPath = Join-Path $outputDir "non-imported-medicines.json"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

aws dynamodb scan `
  --table-name $TableName `
  --projection-expression "medicineId, brandName" `
  --filter-expression "attribute_not_exists(sourceFile)" `
  --output json | Set-Content $scanPath

$scan = Get-Content $scanPath -Raw | ConvertFrom-Json
$items = @($scan.Items)

Write-Host "Found $($items.Count) medicine item(s) without sourceFile in $TableName."

foreach ($item in $items) {
  $brandName = if ($item.brandName.S) { $item.brandName.S } else { "(no brand name)" }
  Write-Host "$($item.medicineId.S) - $brandName"
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Preview only. Re-run with -Apply to delete these items."
  exit 0
}

foreach ($item in $items) {
  $keyPath = Join-Path $outputDir "delete-medicine-key.json"
  @{ medicineId = @{ S = $item.medicineId.S } } | ConvertTo-Json -Compress | Set-Content $keyPath
  aws dynamodb delete-item --table-name $TableName --key "file://$keyPath" | Out-Null
  Write-Host "Deleted $($item.medicineId.S)"
}
