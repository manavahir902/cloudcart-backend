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
- **AWS services used:** VPC, EC2 (historical), ALB, ECS/Fargate, RDS, S3, CloudFront, Cognito, SES, SQS, Lambda, Secrets Manager, KMS, CloudWatch, CloudTrail, WAF, Route 53, ACM, IAM, ECR, CodePipeline, CodeBuild, Budgets.

---

<img width="1106" height="346" alt="Screenshot 2026-08-03 054613" src="https://github.com/user-attachments/assets/0a01db24-f637-4bd8-975d-c8b3d8cfc0a8" />
<img width="1920" height="1080" alt="Screenshot (1821)" src="https://github.com/user-attachments/assets/8d5bfdd4-475b-4d75-9e26-628085823084" />
<img width="1916" height="813" alt="Screenshot 2026-08-03 054057" src="https://github.com/user-attachments/assets/9aa5e3e8-d164-41c7-b9fa-27136d4f94db" />
<img width="1840" height="472" alt="Screenshot (1822)" src="https://github.com/user-attachments/assets/8003bbc8-3abc-4ea8-ab71-0ba2e85a947d" />
<img width="1855" height="311" alt="Screenshot (1823)" src="https://github.com/user-attachments/assets/07fea207-d04f-4f0f-a74d-cb800315096a" />
<img width="1649" height="596" alt="Screenshot (1824)" src="https://github.com/user-attachments/assets/1d19842e-27b8-441d-bb07-73124872136e" />
<img width="1626" height="636" alt="Screenshot (1825)" src="https://github.com/user-attachments/assets/3b40db7e-8dab-4bb5-8ebf-4b727d6731a0" />
<img width="1169" height="608" alt="Screenshot 2026-08-03 054403" src="https://github.com/user-attachments/assets/92e6d0c9-ccc3-4b1f-847d-5a3170bccf88" />
<img width="1165" height="576" alt="Screenshot 2026-08-03 054418" src="https://github.com/user-attachments/assets/64253b6b-168a-4e8e-b68c-9a77c5d87f3b" />
<img width="1171" height="570" alt="Screenshot 2026-08-03 054439" src="https://github.com/user-attachments/assets/4e7c2301-3320-4f97-a224-52449e53f951" />


