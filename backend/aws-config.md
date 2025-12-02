# ============================================
# AWS ECS Deployment Guide
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
# Step 4: Deploy to ECS Fargate
# ============================================
$env:AWS_PAGER = ""
aws ecs update-service --cluster dorsu-cluster --service dorsu-backend-service --force-new-deployment --region $REGION

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
