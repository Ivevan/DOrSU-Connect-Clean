# ============================================
# AWS ECS Deployment Guide
# ============================================

# QUICK START (Recommended):
# Use the automated deployment script:
#   .\deploy.ps1 -UpdateEnvVars
#
# This will:
#   1. Build and push Docker image
#   2. Register new task definition with updated env vars from ecs-container-def.json
#   3. Deploy to ECS Fargate
#
# Options:
#   -SkipImageBuild    : Skip Docker build/push (only update task definition)
#   -UpdateEnvVars     : Force update of environment variables from ecs-container-def.json
#   -TaskFamily <name> : Specify task definition family name (default: dorsu-backend-task)

# ============================================
# MANUAL DEPLOYMENT (Alternative)
# ============================================

# Set variables correctly in PowerShell
$ACCOUNT_ID = "443151264622"
$REGION = "ap-southeast-1"

# ============================================
# Step 1: Build Docker Image
# ============================================
docker build -t dorsu-backend .

# ============================================
# Step 2: Login to ECR (required before push, tokens expire after 12 hours)
# ============================================
$env:AWS_PAGER = ""
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# ============================================
# Step 3: Tag and Push to ECR
# ============================================
docker tag dorsu-backend:latest "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/dorsu-backend:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/dorsu-backend:latest"

# ============================================
# Step 4: Register New Task Definition (if env vars changed)
# ============================================
# IMPORTANT: If you updated ecs-container-def.json with new environment variables,
# you MUST register a new task definition before deploying!
#
# Get the current task definition family name first:
# aws ecs describe-services --cluster dorsu-cluster --services dorsu-backend-service --region $REGION --query "services[0].taskDefinition"
#
# Then register the new task definition using your updated ecs-container-def.json:
$env:AWS_PAGER = ""
$TASK_FAMILY = "dorsu-backend-task"  # Update this if your task family name is different
aws ecs register-task-definition --family $TASK_FAMILY --container-definitions file://ecs-container-def.json --requires-compatibilities FARGATE --network-mode awsvpc --cpu 256 --memory 512 --execution-role-arn arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole --task-role-arn arn:aws:iam::$ACCOUNT_ID:role/ecsTaskRole --region $REGION

# ============================================
# Step 5: Deploy to ECS Fargate
# ============================================
# Update the service to use the new task definition (or force new deployment if only image changed)
$env:AWS_PAGER = ""
# Option A: If you registered a new task definition, update service to use it:
aws ecs update-service --cluster dorsu-cluster --service dorsu-backend-service --task-definition $TASK_FAMILY --region $REGION

# Option B: If you ONLY changed the Docker image (no env var changes), use force-new-deployment:
# aws ecs update-service --cluster dorsu-cluster --service dorsu-backend-service --force-new-deployment --region $REGION

# ============================================
# Load Balancer Information
# ============================================
# Your backend is now accessible via Application Load Balancer:
# DNS: dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com
# 
# This DNS name is STATIC and won't change when tasks restart.
# No need to look up IP addresses anymore!
#
# Test the load balancer:
# curl http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health

# ============================================
# Optional: Check Service Status
# ============================================
# Check if service is running:
aws ecs describe-services --cluster dorsu-cluster --services dorsu-backend-service --region $REGION --query "services[0].{RunningCount:runningCount,DesiredCount:desiredCount,Status:status}"

# Check target health (load balancer):
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:targetgroup/dorsu-backend-tg/b5c3dc95a80fc6ca --region $REGION
