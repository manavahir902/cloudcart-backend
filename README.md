# CloudCart Pro — Production AWS E-Commerce Backend

A production-pattern e-commerce backend built end-to-end on AWS: custom networking, containerized compute, managed auth, async processing, monitoring, and CI/CD — deployed live at **cloudcart.live**.

---

## Architecture

```
                              Internet
                                 │
                          Route 53 (DNS)
                                 │
                    ACM Certificate (HTTPS)
                                 │
                 ┌───────────────────────────┐
                 │   Application Load Balancer │
                 │   (public subnets, 2 AZs)   │
                 └───────────────┬─────────────┘
                                 │
                            AWS WAF
                    (SQLi / XSS / bad-bot rules)
                                 │
                 ┌───────────────────────────┐
                 │      ECS Fargate Service    │
                 │   (private subnets, 2 AZs)  │
                 │   2-4 tasks, auto-scaling   │
                 └───────────────┬─────────────┘
                                 │
        ┌────────────┬──────────┼──────────┬────────────┐
        │             │          │          │            │
   RDS MySQL    Cognito    S3 (images)   SQS Queue   Secrets Manager
  (private, encrypted)  (managed auth)  (private,      → Lambda      (DB password,
                                          CloudFront)   → SES email    fetched at runtime)
```

**Networking:** Custom VPC (`10.0.0.0/16`), 6 subnets across 2 Availability Zones (public / private-app / private-db), NAT Gateway for outbound-only private access, 3-tier security groups (ALB → App → DB, each trusting only the tier before it).

**Compute:** Started on EC2 + Auto Scaling Group + PM2/Nginx, later migrated live (zero downtime) to Docker containers on ECS Fargate — fully serverless, no OS patching or server management.

**Data:** MySQL on RDS, private subnets only, encrypted at rest, transactional writes (order placement uses `SELECT ... FOR UPDATE` row locking to prevent overselling stock under concurrent orders).

**Auth:** Amazon Cognito — managed registration, email verification, login, token issuance. Backend verifies tokens via Cognito's `GetUser` API rather than trusting client-supplied claims.

**Async processing:** Order confirmation emails are queued via SQS and processed by a separate Lambda function — decoupled from the API request path, so a slow/failed email never blocks or fails an order.

**Media delivery:** Product images upload directly to S3 via pre-signed URLs (backend never touches image bytes) and are served publicly through CloudFront, while the S3 bucket itself stays fully private (Origin Access Control).

**Security:** HTTPS everywhere (ACM, auto-renewing), WAF with AWS-managed rule groups + custom rate limiting, Secrets Manager for the database password (not stored in code/env files), least-privilege IAM policies scoped to individual resource ARNs throughout, CloudTrail audit logging on all account activity.

**Observability:** CloudWatch dashboard covering compute/memory/ALB/RDS/target-health metrics, 4 active alarms wired to SNS email alerts (high CPU, high memory, unhealthy targets, low RDS storage).

**CI/CD:** GitHub push → CodePipeline → CodeBuild (Docker build + push to ECR) → automatic ECS deployment. No manual deploy steps.

**Infrastructure as Code:** Core networking/database/load-balancer layer also expressed in Terraform (`/cloudcart-terraform`) — validated via a full apply/destroy cycle against a parallel environment.

---

## Tech Stack

- **Backend:** Node.js 20, Express 5
- **Database:** MySQL 8 (Amazon RDS)
- **Auth:** Amazon Cognito
- **Containerization:** Docker, Amazon ECR, ECS Fargate
- **IaC:** Terraform
- **CI/CD:** AWS CodePipeline, CodeBuild
- **AWS services used:** VPC, EC2 (historical), ALB, ECS/Fargate, RDS, S3, CloudFront, Cognito, SES, SQS, Lambda, Secrets Manager, KMS, CloudWatch, CloudTrail, WAF, Route 53, ACM, IAM, ECR, CodePipeline, CodeBuild, Budgets

