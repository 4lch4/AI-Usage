<#
.SYNOPSIS
  Prints your current Claude and OpenCode Go/Zen usage limits.

.DESCRIPTION
  Claude: reads the Claude Code sign-in from ~/.claude/.credentials.json and calls the same
  OAuth usage endpoint CodexBar uses, returning the 5-hour and weekly windows.

  OpenCode Go: calls https://opencode.ai/zen/go/v1/usage with your OpenCode API key, taken from
  -OpenCodeApiKey, $env:OPENCODE_API_KEY, or the key `opencode auth login` saved in auth.json.

  OpenCode Zen balance: optional. Pass the Cookie header from a signed-in opencode.ai tab with
  -OpenCodeCookie (or $env:OPENCODE_COOKIE) to read the prepaid balance from the console API.

  Works in Windows PowerShell 5.1 and PowerShell 7.

.EXAMPLE
  .\Get-AIUsage.ps1

.EXAMPLE
  .\Get-AIUsage.ps1 -Json
#>
[CmdletBinding()]
param(
  [string]$OpenCodeApiKey = $env:OPENCODE_API_KEY,
  [string]$OpenCodeCookie = $env:OPENCODE_COOKIE,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function New-UsageRow {
  param([string]$Provider, [string]$Window, $UsedPercent, $ResetsAt, [string]$Note)
  $resetsIn = $null
  if ($ResetsAt) {
    $span = $ResetsAt - [DateTimeOffset]::Now
    if ($span.TotalSeconds -lt 0) { $span = [TimeSpan]::Zero }
    $resetsIn = '{0}d {1}h {2}m' -f $span.Days, $span.Hours, $span.Minutes
    $ResetsAt = $ResetsAt.ToLocalTime().ToString('o')
  }
  $used = $null
  if ($null -ne $UsedPercent) { $used = [math]::Round([double]$UsedPercent, 1) }
  [pscustomobject]@{
    Provider    = $Provider
    Window      = $Window
    UsedPercent = $used
    ResetsAt    = $ResetsAt
    ResetsIn    = $resetsIn
    Note        = $Note
  }
}

function Get-FirstValue {
  param($Object, [string[]]$Names)
  if ($null -eq $Object) { return $null }
  foreach ($name in $Names) {
    $prop = $Object.PSObject.Properties[$name]
    if ($prop -and $null -ne $prop.Value) { return $prop.Value }
  }
  return $null
}

function ConvertTo-Date {
  param($Value)
  if ($null -eq $Value -or "$Value" -eq '') { return $null }
  if ($Value -is [datetime]) { return [DateTimeOffset]$Value }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) {
    # Epoch seconds or milliseconds.
    if ($Value -gt 100000000000) { return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$Value) }
    return [DateTimeOffset]::FromUnixTimeSeconds([long]$Value)
  }
  return [DateTimeOffset]::Parse("$Value", [Globalization.CultureInfo]::InvariantCulture)
}

function Get-ClaudeUsage {
  $configDir = $env:CLAUDE_CONFIG_DIR
  if (-not $configDir) { $configDir = Join-Path $HOME '.claude' }
  $credPath = Join-Path $configDir '.credentials.json'
  if (-not (Test-Path $credPath)) {
    throw "No Claude Code sign-in found at $credPath. Run 'claude' and sign in with your Pro account."
  }

  $oauth = (Get-Content $credPath -Raw | ConvertFrom-Json).claudeAiOauth
  if (-not $oauth -or -not $oauth.accessToken) {
    throw "$credPath has no claudeAiOauth token. Run 'claude' and sign in again."
  }
  if ($oauth.expiresAt -and (ConvertTo-Date $oauth.expiresAt) -lt [DateTimeOffset]::Now) {
    # Refreshing here would rotate Claude Code's refresh token, so let Claude Code do it.
    throw "Claude Code's sign-in token has expired. Open 'claude' once to refresh it, then rerun."
  }

  $headers = @{
    Authorization    = "Bearer $($oauth.accessToken)"
    'anthropic-beta' = 'oauth-2025-04-20'
    Accept           = 'application/json'
  }
  $usage = Invoke-RestMethod -Uri 'https://api.anthropic.com/api/oauth/usage' -Headers $headers `
    -UserAgent 'claude-cli/2.1.0 (external, cli)'

  $windows = [ordered]@{
    five_hour        = '5-hour'
    seven_day        = 'Weekly'
    seven_day_opus   = 'Weekly (Opus)'
    seven_day_sonnet = 'Weekly (Sonnet)'
  }
  foreach ($key in $windows.Keys) {
    $w = Get-FirstValue $usage @($key)
    if ($null -eq $w -or $null -eq $w.utilization) { continue }
    New-UsageRow 'Claude' $windows[$key] $w.utilization (ConvertTo-Date $w.resets_at)
  }
}

function Get-OpenCodeApiKey {
  if ($OpenCodeApiKey) { return $OpenCodeApiKey.Trim() }
  $dirs = @()
  if ($env:XDG_DATA_HOME) { $dirs += Join-Path $env:XDG_DATA_HOME 'opencode' }
  $dirs += Join-Path $HOME '.local\share\opencode'
  if ($env:LOCALAPPDATA) { $dirs += Join-Path $env:LOCALAPPDATA 'opencode' }
  foreach ($dir in $dirs) {
    $path = Join-Path $dir 'auth.json'
    if (-not (Test-Path $path)) { continue }
    $auth = Get-Content $path -Raw | ConvertFrom-Json
    $entry = Get-FirstValue $auth @('opencode', 'opencode-go')
    $key = Get-FirstValue $entry @('key', 'apiKey', 'access')
    if ($key) { return "$key".Trim() }
  }
  return $null
}

function Get-OpenCodeGoUsage {
  $key = Get-OpenCodeApiKey
  if (-not $key) {
    throw ('No OpenCode API key found. Create one at https://opencode.ai (workspace > API Keys), then pass ' +
      '-OpenCodeApiKey or set $env:OPENCODE_API_KEY. A Console account login is not enough on its own.')
  }

  $response = Invoke-RestMethod -Uri 'https://opencode.ai/zen/go/v1/usage' `
    -Headers @{ Authorization = "Bearer $key"; Accept = 'application/json' } -UserAgent 'AI-Usage'
  $usage = $response.usage
  if (-not $usage) { throw 'OpenCode Go returned no usage block. Is Go active on this account?' }

  $windows = [ordered]@{
    '5-hour'  = @('rolling', 'rollingUsage')
    'Weekly'  = @('weekly', 'weeklyUsage')
    'Monthly' = @('monthly', 'monthlyUsage')
  }
  foreach ($label in $windows.Keys) {
    $w = Get-FirstValue $usage $windows[$label]
    if ($null -eq $w) { continue }
    if ($w.PSObject.Properties['window']) { $w = $w.window }
    $percent = Get-FirstValue $w @('percent', 'usagePercent', 'usedPercent', 'percentUsed')
    if ($null -eq $percent) { continue }
    $resetIn = Get-FirstValue $w @('resetInSec', 'resetInSeconds')
    if ($null -ne $resetIn) {
      $resetsAt = [DateTimeOffset]::Now.AddSeconds([double]$resetIn)
    } else {
      $resetsAt = ConvertTo-Date (Get-FirstValue $w @('resetsAt', 'resetAt', 'resets_at', 'reset_at'))
    }
    New-UsageRow 'OpenCode Go' $label $percent $resetsAt
  }
}

function Get-OpenCodeZenBalance {
  $headers = @{ Cookie = $OpenCodeCookie; Accept = 'application/json' }
  $orgs = Invoke-RestMethod -Uri 'https://opencode.ai/console/api/orgs' -Headers $headers -UserAgent 'AI-Usage'
  $orgId = @($orgs | ForEach-Object { $_.id } | Where-Object { $_ -match '^(wrk_|org_)' })[0]
  if (-not $orgId) { throw 'No OpenCode workspace found for that cookie.' }

  $headers['x-org-id'] = $orgId
  $billing = Invoke-RestMethod -Uri 'https://opencode.ai/console/api/billing/status' -Headers $headers `
    -UserAgent 'AI-Usage'
  if (-not $billing.balanceMicroCents) { throw "Workspace $orgId has no prepaid Zen balance." }
  $usd = [double]$billing.balanceMicroCents / 100000000
  New-UsageRow 'OpenCode Zen' 'Balance' $null $null ('${0:N2} remaining' -f $usd)
}

$rows = @()
$errors = @()
$sources = [ordered]@{ 'Claude' = { Get-ClaudeUsage }; 'OpenCode Go' = { Get-OpenCodeGoUsage } }
if ($OpenCodeCookie) { $sources['OpenCode Zen'] = { Get-OpenCodeZenBalance } }

foreach ($name in $sources.Keys) {
  try {
    $rows += @(& $sources[$name])
  } catch {
    $errors += [pscustomobject]@{ Provider = $name; Error = $_.Exception.Message }
  }
}

if ($Json) {
  [pscustomobject]@{ fetchedAt = [DateTimeOffset]::Now.ToString('o'); usage = $rows; errors = $errors } |
    ConvertTo-Json -Depth 5
} else {
  $resetCol = @{ Name = 'ResetsAt'; Expression = {
      if ($_.ResetsAt) { ([DateTimeOffset]::Parse($_.ResetsAt)).ToString('ddd HH:mm') } } }
  if ($rows) {
    $rows | Format-Table Provider, Window, UsedPercent, $resetCol, ResetsIn, Note -AutoSize |
      Out-String -Width 200 | Write-Host
  }
  foreach ($e in $errors) { Write-Warning "$($e.Provider): $($e.Error)" }
}
