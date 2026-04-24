param(
    [string]$ApiBaseUrl = "http://127.0.0.1:8000/api/v1",
    [string]$SellerId = "demo-seller",
    [int]$Inventory = 5,
    [int]$PriceCents = 2450,
    [string]$WebhookReference,
    [switch]$SkipWebhook
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body
    )

    $uri = "$ApiBaseUrl$Path"
    if ($PSBoundParameters.ContainsKey("Body")) {
        $json = $Body | ConvertTo-Json -Depth 10
        return Invoke-RestMethod -Method $Method -Uri $uri -ContentType "application/json" -Body $json
    }

    return Invoke-RestMethod -Method $Method -Uri $uri
}

function Get-DatabaseUrl {
    if ($env:DATABASE_URL) {
        return $env:DATABASE_URL
    }

    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
    if (-not (Test-Path $envFile)) {
        return ""
    }

    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*DATABASE_URL=(.*)$") {
            return $matches[1].Trim()
        }
    }

    return ""
}

function Get-DefaultSqlitePath {
    return (Join-Path (Split-Path $PSScriptRoot -Parent) "flashdrop.db")
}

function Resolve-SqlitePath {
    param([string]$DatabaseUrl)

    if (-not $DatabaseUrl) {
        return (Get-DefaultSqlitePath)
    }

    if (-not $DatabaseUrl.StartsWith("sqlite:///")) {
        return $null
    }

    $rawPath = $DatabaseUrl.Substring("sqlite:///".Length)
    if ([System.IO.Path]::IsPathRooted($rawPath)) {
        return $rawPath
    }

    return [System.IO.Path]::GetFullPath((Join-Path (Split-Path $PSScriptRoot -Parent) $rawPath))
}

function Get-PythonExe {
    $venvPython = Join-Path (Split-Path $PSScriptRoot -Parent) ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        return $venvPython
    }

    return "python"
}

function Get-WebhookReferenceFromSqlite {
    param([string]$DropId)

    $databaseUrl = Get-DatabaseUrl
    $sqlitePath = Resolve-SqlitePath -DatabaseUrl $databaseUrl
    if (-not $sqlitePath) {
        return $null
    }

    if (-not (Test-Path $sqlitePath)) {
        return $null
    }

    $pythonExe = Get-PythonExe
    $pythonScript = @'
import sqlite3
import sys

db_path = sys.argv[1]
drop_id = sys.argv[2]

conn = sqlite3.connect(db_path)
try:
    cur = conn.cursor()
    cur.execute(
        "SELECT bunq_reference FROM payments WHERE drop_id = ? ORDER BY created_at DESC LIMIT 1",
        (drop_id,),
    )
    row = cur.fetchone()
    print("" if row is None or row[0] is None else row[0])
finally:
    conn.close()
'@

    $reference = $pythonScript | & $pythonExe - $sqlitePath $DropId
    return "$reference".Trim()
}

Write-Step "Checking API health"
$health = Invoke-Api -Method GET -Path "/health"
$dbHealth = Invoke-Api -Method GET -Path "/health/database"
$health | ConvertTo-Json -Depth 10
$dbHealth | ConvertTo-Json -Depth 10

Write-Step "Generating preview"
$previewRequest = @{
    pitch = "handmade tote for our student design club, only five left"
    media_url = $null
}
$preview = Invoke-Api -Method POST -Path "/drops/generate-preview" -Body $previewRequest
$preview | ConvertTo-Json -Depth 10

Write-Step "Creating draft drop"
$createRequest = @{
    title = $preview.title
    description = $preview.description
    pitch = $previewRequest.pitch
    price_cents = $PriceCents
    currency = "EUR"
    inventory = $Inventory
    media_url = $null
    seller_id = $SellerId
}
$drop = Invoke-Api -Method POST -Path "/drops" -Body $createRequest
$drop | ConvertTo-Json -Depth 10

Write-Step "Fetching created drop"
$fetched = Invoke-Api -Method GET -Path "/drops/$($drop.slug)"
$fetched | ConvertTo-Json -Depth 10

Write-Step "Moving drop to review"
$reviewed = Invoke-Api -Method POST -Path "/drops/$($drop.id)/review"
$reviewed | ConvertTo-Json -Depth 10

Write-Step "Publishing drop"
$published = Invoke-Api -Method POST -Path "/drops/$($drop.id)/publish"
$published | ConvertTo-Json -Depth 10

$resolvedWebhookReference = $WebhookReference
if (-not $resolvedWebhookReference -and -not $SkipWebhook) {
    $resolvedWebhookReference = Get-WebhookReferenceFromSqlite -DropId $drop.id
}

if ($SkipWebhook) {
    Write-Step "Skipping webhook replay by request"
} elseif ($resolvedWebhookReference) {
    Write-Step "Simulating bunq webhook"
    $webhookRequest = @{
        reference = $resolvedWebhookReference
        amount_cents = $PriceCents
        status = "paid"
    }
    $webhookResponse = Invoke-Api -Method POST -Path "/webhooks/bunq" -Body $webhookRequest
    $webhookResponse | ConvertTo-Json -Depth 10
} else {
    Write-Step "Skipping webhook replay because no payment reference could be resolved"
    Write-Host "If you are using Postgres, rerun with -WebhookReference <reference>." -ForegroundColor Yellow
}

Write-Step "Fetching final drop state"
$finalDrop = Invoke-Api -Method GET -Path "/drops/$($drop.slug)"
$finalDrop | ConvertTo-Json -Depth 10

Write-Step "Fetching persisted drop events"
$dropEvents = Invoke-Api -Method GET -Path "/drops/$($drop.slug)/events"
$dropEvents | ConvertTo-Json -Depth 10

Write-Step "Summary"
[pscustomobject]@{
    id = $drop.id
    slug = $drop.slug
    state = $finalDrop.state
    inventory = $finalDrop.inventory
    sold_count = $finalDrop.sold_count
    bunq_tab_url = $finalDrop.bunq_tab_url
    webhook_reference_used = $resolvedWebhookReference
    event_count = @($dropEvents).Count
} | ConvertTo-Json -Depth 10
