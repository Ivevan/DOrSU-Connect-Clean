# Check API and Load Balancer Status
$env:AWS_PAGER = ""
$REGION = "ap-southeast-1"
$TG_ARN = "arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:targetgroup/dorsu-backend-tg/b5c3dc95a80fc6ca"
$ALB_DNS = "dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com"

Write-Host "`n=== Load Balancer Target Health ===" -ForegroundColor Cyan
$targets = aws elbv2 describe-target-health --target-group-arn $TG_ARN --region $REGION --output json | ConvertFrom-Json

if ($targets.TargetHealthDescriptions.Count -eq 0) {
    Write-Host "⚠️  No targets registered yet" -ForegroundColor Yellow
    Write-Host "   Tasks may still be starting. Wait 2-5 minutes and try again." -ForegroundColor Gray
} else {
    Write-Host "✅ Found $($targets.TargetHealthDescriptions.Count) target(s):" -ForegroundColor Green
    foreach ($target in $targets.TargetHealthDescriptions) {
        $health = $target.TargetHealth.State
        $color = if ($health -eq "healthy") { "Green" } else { "Yellow" }
        Write-Host "   Target: $($target.Target.Id):$($target.Target.Port) - Status: $health" -ForegroundColor $color
        if ($target.TargetHealth.Reason) {
            Write-Host "   Reason: $($target.TargetHealth.Reason)" -ForegroundColor Gray
        }
    }
}

Write-Host "`n=== Testing API Endpoint ===" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$ALB_DNS/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ API is responding!" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor White
    Write-Host "   Response: $($response.Content)" -ForegroundColor White
} catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
    Write-Host "❌ API not responding" -ForegroundColor Red
    Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    
    if ($statusCode -eq 503) {
        Write-Host "`n💡 503 means no healthy targets. Wait for tasks to register." -ForegroundColor Yellow
    }
}

Write-Host "`n=== ECS Service Status ===" -ForegroundColor Cyan
$service = aws ecs describe-services --cluster dorsu-cluster --services dorsu-backend-service --region $REGION --output json | ConvertFrom-Json
$svc = $service.services[0]
Write-Host "   Running: $($svc.runningCount)/$($svc.desiredCount)" -ForegroundColor $(if ($svc.runningCount -eq $svc.desiredCount) { "Green" } else { "Yellow" })
Write-Host "   Status: $($svc.status)" -ForegroundColor White

Write-Host "`n"

