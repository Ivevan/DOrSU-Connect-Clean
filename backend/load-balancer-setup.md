# AWS Application Load Balancer Setup

## Overview
An Application Load Balancer (ALB) has been configured for the DOrSU Connect backend service. This provides:
- **Static DNS name** that doesn't change when ECS tasks restart
- **Better reliability** with automatic health checks
- **Scalability** - can handle multiple tasks
- **HTTPS support** (can be configured later)

## Load Balancer Details

### DNS Name
```
dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com
```

### Resources Created
1. **Application Load Balancer**: `dorsu-backend-alb`
   - ARN: `arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:loadbalancer/app/dorsu-backend-alb/9f00c0e57568416e`
   - Type: Internet-facing
   - Scheme: Public

2. **Target Group**: `dorsu-backend-tg`
   - ARN: `arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:targetgroup/dorsu-backend-tg/b5c3dc95a80fc6ca`
   - Protocol: HTTP
   - Port: 3000
   - Health Check Path: `/health`
   - Health Check Interval: 30 seconds

3. **Security Group**: `dorsu-alb-sg`
   - ID: `sg-088919672d12c71a9`
   - Inbound Rules:
     - Port 80 (HTTP) from 0.0.0.0/0
     - Port 443 (HTTPS) from 0.0.0.0/0

4. **Listener**: HTTP on port 80
   - Forwards traffic to target group

## Configuration Updates

### Frontend Configuration
- Updated `frontend/src/config/api.config.ts` with load balancer DNS
- Updated `.env` file with load balancer DNS
- Updated `env.example` for reference

### Android Network Security
- Updated `android/app/src/main/res/xml/network_security_config.xml` to allow ALB domain
- ALB domain: `ap-southeast-1.elb.amazonaws.com`

### ECS Service
- Updated `dorsu-backend-service` to use the load balancer
- Tasks are automatically registered with the target group
- Health checks ensure only healthy tasks receive traffic

## Testing

### Check Load Balancer Status
```bash
aws elbv2 describe-load-balancers --load-balancer-arns arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:loadbalancer/app/dorsu-backend-alb/9f00c0e57568416e --region ap-southeast-1
```

### Check Target Health
```bash
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:ap-southeast-1:443151264622:targetgroup/dorsu-backend-tg/b5c3dc95a80fc6ca --region ap-southeast-1
```

### Test Health Endpoint
```bash
curl http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com/health
```

## Next Steps (Optional)

### 1. Set Up HTTPS
To enable HTTPS:
1. Request an SSL certificate from AWS Certificate Manager (ACM)
2. Create an HTTPS listener on port 443
3. Update frontend to use `https://` instead of `http://`

### 2. Custom Domain
To use a custom domain:
1. Create a Route 53 hosted zone
2. Create an A record (alias) pointing to the load balancer
3. Update frontend configuration with custom domain

### 3. Update Backend Environment Variables
The backend container still has old IP addresses in environment variables. Update:
- `BACKEND_URL`
- `PUBLIC_BACKEND_URL`

These should point to the load balancer DNS name.

## Important Notes

1. **DNS Propagation**: The load balancer DNS may take a few minutes to become fully available
2. **Task Registration**: ECS tasks automatically register with the target group when they start
3. **Health Checks**: Tasks must pass health checks (`/health` endpoint) to receive traffic
4. **Static DNS**: The load balancer DNS name is static and won't change, unlike ECS task IPs

## Cost Considerations

- Application Load Balancer: ~$16/month (fixed cost)
- LCU (Load Balancer Capacity Units): Variable based on traffic
- No additional cost for target groups or listeners

For cost optimization, consider:
- Using Network Load Balancer (NLB) if you don't need ALB features (~$16/month + LCU)
- Or keep using direct IP if cost is a concern (but IPs change on restart)

