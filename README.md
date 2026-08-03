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

---

## Deliberate Design Decisions (and why)

| Decision | Reasoning |
|---|---|
| Pre-signed S3 URLs instead of routing uploads through the API | Backend never handles image bytes — less load, less bandwidth, smaller attack surface |
| SQS + Lambda for order emails, not a direct SES call in the request | A slow/failed email can never block or fail order placement |
| `SELECT ... FOR UPDATE` on stock checks | Prevents two simultaneous orders from both succeeding on the last unit of stock |
| Cognito over hand-rolled JWT auth | Password resets, email verification, and secure token issuance are hard to get right — don't reinvent them |
| Secrets Manager for the DB password, not `.env` | Credentials never sit in plaintext in a launch template, container image, or git history |
| IAM policies scoped to specific resource ARNs, not `*` | Contains the blast radius if any one component is ever compromised |
| Private subnets for app + database tiers | Only the ALB is internet-facing; nothing else has a direct path in |

---

## Known, Deliberately Deferred Items

Being transparent about tradeoffs is itself a signal of engineering maturity — these were conscious "not tonight" calls, not oversights:

- **RDS Multi-AZ** — currently single-AZ; Multi-AZ failover was scoped for Phase 29 and deferred (cost tradeoff for a learning project)
- **`COGNITO_CLIENT_SECRET`** — currently a plain ECS task-definition environment variable; should move to Secrets Manager alongside the DB password
- **ECS Task Role vs Execution Role** — currently share one IAM role for simplicity; a stricter setup separates "what ECS needs to start the container" from "what the app needs at runtime"
- **Unused dependencies** — `bcryptjs` and `jsonwebtoken` remain in `package.json` from before the Cognito migration (Phase 12); no longer imported anywhere, safe to remove
- **Terraform coverage** — currently covers VPC/RDS/ALB only; ECS task definitions, Cognito, S3, and CloudFront are not yet expressed as code
- **Single NAT Gateway** — one NAT Gateway in one AZ (matches manual build); a fully HA setup would use one per AZ

---

## What Actually Happened Under Load/Failure Testing

- Manually terminated a running ECS task mid-traffic: **zero downtime observed** — the ALB routed exclusively to the remaining healthy task while ECS launched a replacement (~1-2 min recovery)
- Confirmed running tasks are distributed across both Availability Zones, not concentrated in one
- Load-tested the API to observe auto-scaling behavior under the CPU-based target-tracking policy

---

## Resume Bullet Points

- Architected and deployed a production-pattern e-commerce backend on AWS, spanning custom VPC networking, containerized compute (ECS Fargate), managed auth (Cognito), and CI/CD (CodePipeline/CodeBuild)
- Migrated a live application from EC2/Auto Scaling to Docker containers on ECS Fargate with zero downtime, using a blue/green-style ALB listener-rule cutover
- Implemented least-privilege IAM across 10+ distinct service integrations, scoping every policy to specific resource ARNs rather than wildcard permissions
- Built an async order-processing pipeline (SQS → Lambda → SES) to decouple email delivery from the critical request path
- Secured credentials via AWS Secrets Manager, eliminating plaintext database passwords from source control and infrastructure config
- Established observability via CloudWatch dashboards and SNS-integrated alarms across compute, database, and load-balancer metrics
- Authored Terraform modules for core infrastructure (VPC, RDS, ALB), validated via full apply/destroy cycles
- Load- and failure-tested the deployed system, confirming zero-downtime task recovery and correct multi-AZ task distribution

---

## Interview Talking Points

**"Walk me through the architecture"** → Use the diagram above; narrate request flow: Route 53 → ACM/HTTPS → WAF → ALB → Fargate → RDS/Cognito/S3/SQS.

**"How would you improve this further?"** → Point directly to the "Known, Deliberately Deferred Items" section above — a real, considered list beats a vague "add more monitoring."

**"How do you handle secrets?"** → Secrets Manager for DB credentials, fetched at runtime via IAM role, never in code or environment files baked into an image.

**"How does this scale?"** → ECS Fargate target-tracking auto-scaling on CPU (2-4 tasks), ALB distributing across 2 AZs, RDS connection pooling in the app layer.

**"What would you do differently starting over?"** → Honest answer: define ECS/Cognito/S3 in Terraform from the start rather than console-first, then codify — retrofitting IaC after manual builds is more work than starting with it.
