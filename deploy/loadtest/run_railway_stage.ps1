[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(1, 25, 50, 100, 150, 200, 250)]
    [int]$Users,
    [ValidateRange(1, 50)]
    [int]$SpawnRate = 5,
    [ValidatePattern('^[0-9]+[smh]$')]
    [string]$Duration = '2m',
    [string]$OutputRoot = 'deploy/loadtest/results/railway'
)

$ErrorActionPreference = 'Stop'
$RailwayHost = 'https://anticheatoesv2-staging.up.railway.app'

if ([string]::IsNullOrWhiteSpace($env:LOADTEST_PASSWORD)) {
    throw 'Set LOADTEST_PASSWORD in the current shell. Do not commit it.'
}

# The Locust workload allocates individual accounts with a 6:3:1 role mix.
$env:LOADTEST_MODE = 'railway'
$env:LOADTEST_ALLOW_STAGING_WRITES = 'yes'
$env:LOADTEST_ALLOW_TEACHER_MUTATION = 'no'
$env:LOADTEST_STUDENT_COUNT = '150'
$env:LOADTEST_TEACHER_COUNT = '75'
$env:LOADTEST_ADMIN_COUNT = '25'

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outputDir = Join-Path $OutputRoot "pt_$('{0:d3}' -f $Users)_$stamp"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$csvPrefix = Join-Path $outputDir "stage$Users"

$metadata = [ordered]@{
    target = 'Railway staging'
    host = $RailwayHost
    started_at_local = (Get-Date).ToString('o')
    users = $Users
    spawn_rate_per_second = $SpawnRate
    duration = $Duration
    role_mix = 'Student:Teacher:Admin = 6:3:1'
    account_pool = @{ students = 150; teachers = 75; admins = 25 }
    teacher_mutation_enabled = $false
}
$metadata | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $outputDir 'metadata.json') -Encoding utf8

try {
    Invoke-RestMethod -Uri "$RailwayHost/health/ready" -TimeoutSec 20 |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir 'health_before.json') -Encoding utf8

    uvx --with locust locust -f deploy/loadtest/locustfile.py --host $RailwayHost --headless `
        --only-summary --csv $csvPrefix --csv-full-history -u $Users -r $SpawnRate -t $Duration
}
finally {
    try {
        Invoke-RestMethod -Uri "$RailwayHost/health/ready" -TimeoutSec 20 |
            ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir 'health_after.json') -Encoding utf8
    }
    catch {
        @{ error = $_.Exception.Message; checked_at_local = (Get-Date).ToString('o') } |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputDir 'health_after.json') -Encoding utf8
        throw
    }
}
