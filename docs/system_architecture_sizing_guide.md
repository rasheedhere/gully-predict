# System Architecture, Sizing & Cost Guide (500K Users / 50K Leagues)

This guide provides recommended hardware, software configurations, and monthly hosting cost estimates for deploying `gully-predict` to support 500,000 users, 50,000 leagues, and 1.5 million league-user mappings.

---

## 1. Memory Sizing Estimation
To understand CPU/Memory requirements, we estimate the memory footprint of our largest dataset in memory during leaderboard generation:
* **1.5M League Mappings:** Storing `(league_id, user_id, joined_at)` in memory as a dictionary lookup takes roughly **120 MB – 150 MB** of RAM in Python.
* **1.5M Cache Entries:** Loading points maps for dictionary lookups takes **100 MB – 120 MB** of RAM.
* **Total Scoring Run RAM Overhead:** **< 500 MB** of active memory.

---

## 2. Recommended Infrastructure Sizing

### 💻 A. Backend App Servers (FastAPI / Uvicorn)
Because our backend is highly asynchronous (using Python's `asyncio` and `asyncpg`), it is extremely light on CPU and scales horizontally.

* **Deployment Model:** Containerized (ECS, Kubernetes, or Render) with a load balancer.
* **Instance Count:** 2 to 3 instances minimum (for High Availability).
* **Specs per Instance:**
  * **vCPU:** 2 Cores (Intel/AMD or AWS Graviton).
  * **Memory:** 2 GB to 4 GB RAM.
* **Uvicorn Worker Config:** Run 2 to 4 workers per container (using `--workers` flag) to maximize multi-core usage.

### 🗄️ B. Database Configuration (PostgreSQL)
Since we optimized database roundtrips to $O(1)$ set-based bulk queries, the database's primary bottleneck is **memory (for caching indexes)** and **disk I/O (for quick writes)**.

* **Hardware Recommendation (Production RDS / Neon / Cloud SQL):**
  * **vCPU:** 4 Cores.
  * **Memory:** 16 GB RAM (ensures the entire database working set and indexes fit completely in the database buffer cache).
  * **Storage:** SSD (gp3 on AWS) with at least 3,000 provisioned IOPS to handle peak write bursts when releasing scores.
* **Key PostgreSQL Settings (`postgresql.conf`):**
  * `shared_buffers = 4GB` (allocates 25% of RAM for DB cache).
  * `work_mem = 64MB` (ensures sorting/grouping in our bulk queries happens entirely in RAM instead of swapping to disk).
  * `max_connections = 250` (or use a pooler like PgBouncer with a pool size of ~50).

### 🚀 C. Cache & Session Layer (Redis)
Because we invalidate in-memory cache keys (like `leaderboard_*`) on scoring updates, Redis acts as our central high-performance cache.

* **Hardware Recommendation:**
  * **Instance Size:** AWS ElastiCache `cache.t4g.small` or `cache.t4g.medium` (with 1.5 GB to 3 GB of RAM).
  * **Eviction Policy:** `allkeys-lru` (ensures old or inactive leaderboard caches are automatically removed if memory fills up).

---

## 3. Monthly Cloud Cost Estimates (AWS Deployment)

Estimates are calculated using standard AWS US-East pricing rules:

| Component | AWS Resource | Sizing Specs | Monthly Cost (Est.) |
| :--- | :--- | :--- | :--- |
| **App Servers** | ECS Fargate (2x tasks) | 2 vCPU / 4 GB RAM per task | ~$65.00 |
| **Database** | RDS PostgreSQL (db.m6g.xlarge) | 4 vCPU / 16 GB RAM / 100 GB gp3 SSD | ~$210.00 |
| **Cache Layer** | Amazon ElastiCache (cache.t4g.medium) | 1 node / 3 GB RAM | ~$35.00 |
| **Networking** | Application Load Balancer (ALB) | 1 ALB + standard data transfer | ~$40.00 |
| **Total Cost** | **Full Production Deployment** | | **~$350.00 / month** |

### Cost Reduction Tips:
* **Database Scaling:** You can start with `db.m6g.large` (2 vCPU, 8GB RAM) for ~$105/month during off-season and scale up to `db.m6g.xlarge` during peak match seasons.
* **Compute Savings Plans:** Purchasing a 1-year AWS Compute Savings Plan for ECS tasks can reduce Fargate costs by up to 20–30%.
