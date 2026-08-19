param(
  [string] $TableName = "DawaaUsers",
  [string] $Region = "eu-north-1",
  [string] $UserId = "USER#ADMIN",
  [Parameter(Mandatory = $true)]
  [string] $Email,
  [Parameter(Mandatory = $true)]
  [string] $Password,
  [string] $Name = "Admin"
)

$ErrorActionPreference = "Stop"

$normalizedEmail = $Email.Trim().ToLowerInvariant()
$salt = "dawaa_salt_2024"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($Password + $salt)
$hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$passwordHash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
$now = [DateTimeOffset]::UtcNow.ToString("o")

$existing = aws dynamodb query `
  --table-name $TableName `
  --index-name "email-index" `
  --key-condition-expression "email = :email" `
  --expression-attribute-values "{`":email`":{`"S`":`"$normalizedEmail`"}}" `
  --region $Region | ConvertFrom-Json

if ($existing.Count -gt 0) {
  throw "A user with email '$normalizedEmail' already exists in $TableName."
}

$item = @{
  userId = @{ S = $UserId }
  email = @{ S = $normalizedEmail }
  name = @{ S = $Name.Trim() }
  role = @{ S = "admin" }
  passwordHash = @{ S = $passwordHash }
  active = @{ BOOL = $true }
  createdAt = @{ S = $now }
  updatedAt = @{ S = $now }
} | ConvertTo-Json -Depth 4 -Compress

aws dynamodb put-item `
  --table-name $TableName `
  --item $item `
  --condition-expression "attribute_not_exists(userId)" `
  --region $Region

Write-Host "Created admin user '$normalizedEmail' with userId '$UserId'."
