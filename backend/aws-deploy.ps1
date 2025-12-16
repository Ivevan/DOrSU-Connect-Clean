# ============================================
# AWS ECS Deployment Script
# ============================================
# Combines Docker image deployment with environment variable updates
# 
# Usage:
#   .\aws-deploy.ps1                    # Full deployment (build + push + update env vars)
#   .\aws-deploy.ps1 -SkipImageBuild    # Only update env vars (skip Docker build/push)
# ============================================

param(
    [switch]$SkipImageBuild = $false
)

# ============================================
# Configuration
# ============================================
$ACCOUNT_ID = "443151264622"
$REGION = "ap-southeast-1"
$CLUSTER = "dorsu-cluster"
$SERVICE = "dorsu-backend-service"
$TASK_FAMILY = "dorsu-backend-task"
$CONTAINER_DEF_FILE = "ecs-container-def.json"
$IMAGE_NAME = "dorsu-backend"
$ECR_REPOSITORY = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/dorsu-backend:latest"

# Disable AWS CLI pager for cleaner output
$env:AWS_PAGER = ""

# ============================================
# Script Start
# ============================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "AWS ECS Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Step 1: Validate Container Definition File
# ============================================
Write-Host "Step 1: Validating container definition file..." -ForegroundColor Yellow

if (-not (Test-Path $CONTAINER_DEF_FILE)) {
    Write-Host "❌ Container definition file not found: $CONTAINER_DEF_FILE" -ForegroundColor Red
    Write-Host "   Make sure you're running this script from the backend directory." -ForegroundColor Yellow
    exit 1
}

# Verify JSON is valid
try {
    $containerDefContent = Get-Content $CONTAINER_DEF_FILE -Raw
    $null = $containerDefContent | ConvertFrom-Json
    Write-Host "   ✓ Container definition file is valid JSON" -ForegroundColor Green
} catch {
    Write-Host "❌ Container definition file is not valid JSON!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# Step 2: Build and Push Docker Image (if not skipped)
# ============================================
if (-not $SkipImageBuild) {
    Write-Host "Step 2: Building Docker image..." -ForegroundColor Yellow
    Write-Host "   Command: docker build -t $IMAGE_NAME ." -ForegroundColor DarkGray
    docker build -t $IMAGE_NAME .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ Docker image built successfully" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Step 3: Logging into ECR..." -ForegroundColor Yellow
    Write-Host "   Command: aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com" -ForegroundColor DarkGray
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ECR login failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✓ Logged into ECR successfully" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Step 4: Tagging and pushing to ECR..." -ForegroundColor Yellow
    Write-Host "   Command: docker tag $IMAGE_NAME`:latest $ECR_REPOSITORY" -ForegroundColor DarkGray
    docker tag "$IMAGE_NAME`:latest" $ECR_REPOSITORY
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker tag failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   Command: docker push $ECR_REPOSITORY" -ForegroundColor DarkGray
    docker push $ECR_REPOSITORY
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker push failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   ✓ Image pushed to ECR successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Step 2: Skipping Docker build/push (using existing image)" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================
# Step 3: Get Current Task Definition
# ============================================
$stepNumber = if ($SkipImageBuild) { 3 } else { 5 }
Write-Host "Step $stepNumber`: Fetching current task definition..." -ForegroundColor Yellow
Write-Host "   Command: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query `"services[0].taskDefinition`" --output text" -ForegroundColor DarkGray

$currentTaskDef = aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query "services[0].taskDefinition" --output text

if (-not $currentTaskDef) {
    Write-Host "❌ Could not fetch current task definition!" -ForegroundColor Red
    Write-Host "   Make sure the service exists and is running." -ForegroundColor Yellow
    Write-Host "   Command to check service: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION" -ForegroundColor DarkGray
    exit 1
}

Write-Host "   Current task definition: $currentTaskDef" -ForegroundColor Gray

# Get task definition details
Write-Host "   Command: aws ecs describe-task-definition --task-definition $currentTaskDef --region $REGION --output json" -ForegroundColor DarkGray
$taskDefJson = aws ecs describe-task-definition --task-definition $currentTaskDef --region $REGION --output json
$taskDef = ($taskDefJson | ConvertFrom-Json).taskDefinition

Write-Host "   CPU: $($taskDef.cpu), Memory: $($taskDef.memory)" -ForegroundColor Gray
Write-Host "   Execution Role: $($taskDef.executionRoleArn)" -ForegroundColor Gray
Write-Host "   Task Role: $($taskDef.taskRoleArn)" -ForegroundColor Gray
Write-Host ""

# ============================================
# Step 4: Register New Task Definition with Updated Environment Variables
# ============================================
$stepNumber = if ($SkipImageBuild) { 4 } else { 6 }
Write-Host "Step $stepNumber`: Registering new task definition with updated env vars..." -ForegroundColor Yellow
Write-Host "   Using container definitions from: $CONTAINER_DEF_FILE" -ForegroundColor Gray
Write-Host "   Command: aws ecs register-task-definition --family $TASK_FAMILY --container-definitions file://$CONTAINER_DEF_FILE --requires-compatibilities FARGATE --network-mode awsvpc --cpu $($taskDef.cpu) --memory $($taskDef.memory) --execution-role-arn $($taskDef.executionRoleArn) --task-role-arn $($taskDef.taskRoleArn) --region $REGION" -ForegroundColor DarkGray

# Register new task definition
$registerResult = aws ecs register-task-definition `
    --family $TASK_FAMILY `
    --container-definitions file://$CONTAINER_DEF_FILE `
    --requires-compatibilities FARGATE `
    --network-mode awsvpc `
    --cpu $taskDef.cpu `
    --memory $taskDef.memory `
    --execution-role-arn $taskDef.executionRoleArn `
    --task-role-arn $taskDef.taskRoleArn `
    --region $REGION

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Task definition registration failed!" -ForegroundColor Red
    Write-Host $registerResult -ForegroundColor Red
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Check that ecs-container-def.json is valid JSON" -ForegroundColor DarkGray
    Write-Host "   - Verify all required fields are present in the container definition" -ForegroundColor DarkGray
    Write-Host "   - Check AWS credentials: aws sts get-caller-identity" -ForegroundColor DarkGray
    exit 1
}

Write-Host "   ✓ New task definition registered successfully" -ForegroundColor Green
Write-Host ""

# ============================================
# Step 5: Update ECS Service
# ============================================
$stepNumber = if ($SkipImageBuild) { 5 } else { 7 }
Write-Host "Step $stepNumber`: Updating ECS service to use new task definition..." -ForegroundColor Yellow
Write-Host "   Command: aws ecs update-service --cluster $CLUSTER --service $SERVICE --task-definition $TASK_FAMILY --region $REGION" -ForegroundColor DarkGray

$updateResult = aws ecs update-service `
    --cluster $CLUSTER `
    --service $SERVICE `
    --task-definition $TASK_FAMILY `
    --region $REGION

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Service update failed!" -ForegroundColor Red
    Write-Host $updateResult -ForegroundColor Red
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Check service exists: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION" -ForegroundColor DarkGray
    Write-Host "   - Verify cluster exists: aws ecs describe-clusters --clusters $CLUSTER --region $REGION" -ForegroundColor DarkGray
    exit 1
}

Write-Host "   ✓ Service update initiated successfully" -ForegroundColor Green
Write-Host ""

# ============================================
# Step 6: Wait for Deployment to Complete
# ============================================
$stepNumber = if ($SkipImageBuild) { 6 } else { 8 }
Write-Host "Step $stepNumber`: Waiting for deployment to stabilize..." -ForegroundColor Yellow
Write-Host "   This may take 2-5 minutes..." -ForegroundColor Gray
Write-Host "   Command: aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION" -ForegroundColor DarkGray
Write-Host "   (Press Ctrl+C to skip waiting and check manually)" -ForegroundColor DarkGray
Write-Host ""

try {
    aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Deployment completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Your deployment is now live with updated environment variables!" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  Deployment may still be in progress." -ForegroundColor Yellow
        Write-Host "   Check AWS Console for status." -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Skipped waiting. Check deployment status manually." -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# Deployment Summary
# ============================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Backend URL: http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com" -ForegroundColor White
Write-Host ""

Write-Host "Useful Console Commands:" -ForegroundColor Yellow
Write-Host ""

Write-Host "  # Check service status and deployment progress" -ForegroundColor Gray
Write-Host "  aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # List running tasks" -ForegroundColor Gray
Write-Host "  aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE --region $REGION" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # Get task details (replace TASK_ID with actual task ID from above)" -ForegroundColor Gray
Write-Host "  aws ecs describe-tasks --cluster $CLUSTER --tasks TASK_ID --region $REGION" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # View service events (deployment history)" -ForegroundColor Gray
Write-Host "  aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].events[0:10]' --output table" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # Check task definition revisions" -ForegroundColor Gray
Write-Host "  aws ecs list-task-definitions --family-prefix $TASK_FAMILY --region $REGION --sort-by DESC" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # View container logs (requires CloudWatch Logs)" -ForegroundColor Gray
Write-Host "  aws logs tail /ecs/dorsu-backend --follow --region $REGION" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  # Test backend health endpoint" -ForegroundColor Gray
Write-Host "  curl http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/api/health" -ForegroundColor DarkGray
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

