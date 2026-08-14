param(
    [string]$Project = "oes-postpull-verify",
    [string]$BaseUrl = "http://127.0.0.1:18080",
    [string]$Password = $env:LOADTEST_PASSWORD,
    [string]$OutputPath = "deploy/loadtest/results/postpull_20260814/failure_injection.json"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Set LOADTEST_PASSWORD to the disposable load-test password before running this script."
}

$compose = @("compose", "-p", $Project, "-f", "docker-compose.yml", "-f", "docker-compose.test.yml")
$teacherEmail = "load.teacher.001@example.test"
$adminEmail = "load.admin.001@example.test"
$examId = 1
$subjectId = "LOAD101"
$results = [ordered]@{ started_at = (Get-Date).ToUniversalTime().ToString("o"); checks = @() }

function Invoke-OesApi {
    param([string]$Method, [string]$Path, [string]$Token, [object]$Body)
    $headers = @{ Authorization = "Bearer $Token"; "X-Request-ID" = [guid]::NewGuid().ToString() }
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    }
    $response = Invoke-WebRequest @params
    return [pscustomobject]@{ StatusCode = $response.StatusCode; Body = $response.Content | ConvertFrom-Json }
}

function Login-Oes([string]$Email) {
    $response = Invoke-OesApi "POST" "/api/auth/login" "" @{ email = $Email; password = $Password }
    if ($response.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($response.Body.token)) {
        throw "Login failed for $Email"
    }
    return $response.Body.token
}

function Add-Check([string]$Name, [bool]$Passed, [hashtable]$Details) {
    $results.checks += [ordered]@{ name = $Name; passed = $Passed; details = $Details }
    if (-not $Passed) { throw "Failure injection check failed: $Name" }
}

function Mysql-Scalar([string]$Sql) {
    $output = & docker @compose exec -T mysql-test mysql -uoes_test -poes_test_password -D online_exam_test -N -B -e $Sql
    if ($LASTEXITCODE -ne 0) { throw "MySQL verification query failed" }
    return ($output | Out-String).Trim()
}

# Reusing a student with an active attempt would correctly return a resume
# requirement. Use separate idle accounts for Redis and RabbitMQ scenarios.
$idleStudentSql = "SELECT u.school_id FROM user u WHERE u.school_id LIKE 'LOAD_STUDENT_%' AND NOT EXISTS (SELECT 1 FROM attempt a WHERE a.student_id = u.school_id AND a.status = 'in_progress') ORDER BY u.school_id LIMIT 1"
$studentSchoolId = Mysql-Scalar $idleStudentSql
$rabbitStudentSchoolId = Mysql-Scalar "$idleStudentSql OFFSET 1"
if ([string]::IsNullOrWhiteSpace($studentSchoolId) -or [string]::IsNullOrWhiteSpace($rabbitStudentSchoolId)) {
    throw "Two disposable students without in-progress attempts are required. Recreate the verification database."
}
$studentEmail = (($studentSchoolId -replace "LOAD_STUDENT_", "load.student.") + "@example.test").ToLowerInvariant()
$rabbitStudentEmail = (($rabbitStudentSchoolId -replace "LOAD_STUDENT_", "load.student.") + "@example.test").ToLowerInvariant()

function Save-TeacherSettings([string]$TeacherToken) {
    $current = Invoke-OesApi "GET" "/api/teacher/exams/$examId/settings" $TeacherToken $null
    $payload = @{
        shuffle_question = [bool]$current.Body.shuffle_question
        shuffle_answer_options = [bool]$current.Body.shuffle_answer_options
        sequential_navigation = [bool]$current.Body.sequential_navigation
        auto_submit_on_expire = [bool]$current.Body.auto_submit_on_expire
        grace_period = [int]$current.Body.grace_period
        anti_cheat_enabled = [bool]$current.Body.anti_cheat_enabled
        violation_limit = [int]$current.Body.violation_limit
        auto_grade = [bool]$current.Body.auto_grade
        result_strategy = [string]$current.Body.result_strategy
        result_visibility = [string]$current.Body.result_visibility
        expectedVersion = [int]$current.Body.version
    }
    return Invoke-OesApi "PUT" "/api/teacher/exams/$examId/settings" $TeacherToken $payload
}

function Start-StudentAttempt([string]$StudentToken, [string]$DeviceId) {
    return Invoke-OesApi "POST" "/api/exams/$examId/start" $StudentToken @{ code = $null; deviceId = $DeviceId }
}

function Replace-AdminPermissions([string]$AdminToken) {
    return Invoke-OesApi "PATCH" "/api/admin/teachers/LOAD_TEACHER_001/permissions" $AdminToken @{ subject_ids = @($subjectId) }
}

$studentToken = Login-Oes $studentEmail
$rabbitStudentToken = Login-Oes $rabbitStudentEmail
$teacherToken = Login-Oes $teacherEmail
$adminToken = Login-Oes $adminEmail

try {
    & docker @compose stop redis
    if ($LASTEXITCODE -ne 0) { throw "Could not stop Redis" }

    $student = Start-StudentAttempt $studentToken "failure-redis-$([guid]::NewGuid())"
    Add-Check "redis_down.student_start" ($student.StatusCode -eq 200) @{ attempt_id = $student.Body.attemptId }

    $teacher = Save-TeacherSettings $teacherToken
    Add-Check "redis_down.teacher_save" ($teacher.StatusCode -eq 200) @{ version = $teacher.Body.version }

    $admin = Replace-AdminPermissions $adminToken
    Add-Check "redis_down.admin_permission_update" ($admin.StatusCode -eq 200) @{ active_permissions = @($admin.Body.permissions).Count }

    $ready = Invoke-OesApi "GET" "/health/ready" "" $null
    Add-Check "redis_down.readiness_degraded" ($ready.StatusCode -eq 200 -and $ready.Body.redis -eq "degraded") @{ readiness = $ready.Body }
}
finally {
    & docker @compose up -d redis | Out-Null
}

try {
    & docker @compose stop rabbitmq
    if ($LASTEXITCODE -ne 0) { throw "Could not stop RabbitMQ" }

    $student = Start-StudentAttempt $rabbitStudentToken "failure-rabbit-$([guid]::NewGuid())"
    Add-Check "rabbit_down.student_start" ($student.StatusCode -eq 200) @{ attempt_id = $student.Body.attemptId }

    $teacher = Save-TeacherSettings $teacherToken
    Add-Check "rabbit_down.teacher_save" ($teacher.StatusCode -eq 200) @{ version = $teacher.Body.version }

    $requestId = "failure-rabbit-$([guid]::NewGuid())"
    $job = Invoke-OesApi "POST" "/api/admin/reports/exams/$examId/report-jobs" $adminToken @{ requestId = $requestId }
    Add-Check "rabbit_down.admin_report_job" ($job.StatusCode -eq 202) @{ job_id = $job.Body.jobId; request_id = $requestId }

    $pending = [int](Mysql-Scalar "SELECT COUNT(*) FROM outbox_event WHERE published_at IS NULL")
    Add-Check "rabbit_down.outbox_persisted" ($pending -gt 0) @{ pending_outbox_events = $pending }
}
finally {
    & docker @compose up -d rabbitmq | Out-Null
}

# RabbitMQ's healthcheck and the publisher's reconnect are asynchronous. Poll
# the durable MySQL outbox instead of assuming a fixed reconnect duration.
$remaining = -1
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 2
    $remaining = [int](Mysql-Scalar "SELECT COUNT(*) FROM outbox_event WHERE published_at IS NULL")
    if ($remaining -eq 0) { break }
}
Add-Check "rabbit_recovery.outbox_drained" ($remaining -eq 0) @{ pending_outbox_events = $remaining }

$results.completed_at = (Get-Date).ToUniversalTime().ToString("o")
$results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "Failure injection checks passed. Evidence: $OutputPath"
