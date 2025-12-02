# You already built the image; if needed, rebuild:
docker build -t dorsu-backend .

# Set variables correctly in PowerShell
$ACCOUNT_ID = "443151264622"
$REGION = "ap-southeast-1"

# IMPORTANT: Login to ECR first (required before push, tokens expire after 12 hours)
$env:AWS_PAGER = ""
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Tag with full ECR repo name
docker tag dorsu-backend:latest "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/dorsu-backend:latest"

# Push to ECR
docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/dorsu-backend:latest"


# Fargate Push
$env:AWS_PAGER = ""
$REGION = "ap-southeast-1"

aws ecs update-service --cluster dorsu-cluster --service dorsu-backend-service --force-new-deployment --region $REGION


# Get the task ARN
$REGION = "ap-southeast-1"
$env:AWS_PAGER = ""

$TASK_ARN = aws ecs list-tasks --cluster dorsu-cluster --service-name dorsu-backend-service --region $REGION --query "taskArns[0]" --output text
$TASK_ARN

# Get Public IP
$ENI_ID = aws ecs describe-tasks --cluster dorsu-cluster --tasks $TASK_ARN --region $REGION --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text
$ENI_ID

aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region $REGION --query "NetworkInterfaces[0].Association.PublicIp" --output text
