# Kube Playground

> An interactive, observable Kubernetes laboratory for exploring microservices orchestration, real-time autoscaling, and traffic dynamics under live load.

<!-- GitHub Repository: [Add your GitHub repository URL here] -->

---

## Overview

**Kube Playground** is a local, hands-on Kubernetes learning and experimentation environment. It brings together a multi-tier microservice architecture, real-time metrics collection, in-cluster load generation, and an interactive dashboard.

Instead of working with opaque black-box services or static examples, Kube Playground gives developers and platform engineers immediate visual feedback on cluster mechanics: observe pods launch and terminate in response to CPU saturation, watch the Horizontal Pod Autoscaler (HPA) react dynamically, inspect service-to-service call graphs, and control load generation directly from a web UI.

---

## Problem Statement

Understanding Kubernetes mechanics—such as Pod lifecycles, Horizontal Pod Autoscaling (HPA), Ingress routing, resource requests versus limits, and multi-service failure propagation—is often challenging:
- Static documentation explains API schemas, but does not visualize real-time behavior under fluctuating workloads.
- Public cloud clusters can be slow to spin up, incur ongoing operational costs, and abstract away node-level primitives.
- Typical sample applications are either overly simplistic (e.g., a static `nginx` container) or too complex to easily modify and debug locally.

**Kube Playground** solves this by providing a self-contained, reproducible playground where workloads generate authentic CPU burn and distributed network traffic, exposing all internal telemetry to a real-time reactive dashboard.

---

## High-Level Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │               Developer Browser               │
                    └───────┬───────────────────────────────┬───────┘
                            │ :3000                         │ :4000
                            ▼                               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ Kubernetes Cluster (Minikube)                                          │
  │                                                                        │
  │  [ platform namespace ]                                                │
  │   ┌─────────────────────┐             ┌───────────────────────────┐    │
  │   │   Web Dashboard     │◀───────────▶│   Control API Backend     │    │
  │   │   (Next.js React)   │             │   (Node.js Fastify)       │    │
  │   └─────────────────────┘             └─────────────┬─────────────┘    │
  │                                                     │                  │
  │  [ loadtest namespace ]                             │ Controls Jobs    │
  │   ┌─────────────────────────────────────────┐       │ via K8s API      │
  │   │   k6 Load Generator (batch/v1 Jobs)     │◀──────┘                  │
  │   └────────────────────┬────────────────────┘                          │
  │                        │                                               │
  │  [ apps namespace ]    │ HTTP Traffic                                  │
  │                        ▼                                               │
  │               ┌─────────────────┐                                      │
  │               │  Ingress NGINX  │                                      │
  │               └────────┬────────┘                                      │
  │                        │                                               │
  │       ┌────────────────┼────────────────┐                              │
  │       ▼                ▼                ▼                              │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
  │  │  svc-a   │───▶│  svc-b   │───▶│  svc-c   │ (Chain / Fanout)         │
  │  └────┬─────┘    └────┬─────┘    └────┬─────┘                          │
  │       │               │               │                                │
  │   HPA │           HPA │           HPA │ (Target: 50% CPU)              │
  │       ▼               ▼               ▼                                │
  │   [ 1-5 Pods ]    [ 1-5 Pods ]    [ 1-5 Pods ]                         │
  └────────────────────────────────────────────────────────────────────────┘
```

The system is separated into three distinct namespaces:
1. **`apps`**: Houses the core business microservices (`svc-a`, `svc-b`, `svc-c`), their cluster-internal Services, HPAs, and Ingress rules.
2. **`platform`**: Houses the control plane components—the `control-api` backend (which queries the Kubernetes API and streams telemetry) and the `web` dashboard frontend.
3. **`loadtest`**: An isolated sandbox where the control backend schedules ephemeral `k6` load generation jobs.

---

## Tech Stack

- **Containerization & Cluster**: Docker, Minikube, Kubernetes (v1.30+)
- **Microservices**: TypeScript, Node.js 22, Express, Prom-Client
- **Autoscaling & Ingress**: Horizontal Pod Autoscaler (HPA v2), Kubernetes `metrics-server`, Ingress-NGINX Controller
- **Control Backend**: Fastify, `@kubernetes/client-node`, Server-Sent Events (SSE)
- **Dashboard UI**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons
- **Load Generation**: Grafana k6 (distributed load profiles, externally tunable)

---

## Repository Structure

```
kube-playground/
├── k8s/                         # Kubernetes manifests
│   ├── namespaces/              # Namespace definitions (apps, platform, loadtest)
│   ├── apps/                    # Core microservices, HPAs, and Ingress
│   │   ├── svc-a/               # Deployment, Service, HPA, ServiceAccount
│   │   ├── svc-b/               # Deployment, Service, HPA, ServiceAccount
│   │   ├── svc-c/               # Deployment, Service, HPA, ServiceAccount
│   │   └── ingress-playground.yaml
│   ├── platform/                # Platform control plane manifests
│   │   ├── deployment-control-api.yaml
│   │   ├── deployment-web.yaml
│   │   ├── ingress-platform.yaml
│   │   └── role-control-api-*.yaml # Scoped RBAC configurations
│   └── loadtest/                # k6 load testing scripts and ConfigMaps
├── services/                    # Shared microservice codebase (svc-a, svc-b, svc-c)
│   ├── src/                     # Dual-port HTTP endpoints (8080 app, 9090 telemetry)
│   ├── Dockerfile               # Multi-stage parameterized container build
│   └── package.json
├── control-api/                 # Cluster telemetry and job management backend
│   ├── src/                     # Kubernetes API polling, k6 executor, SSE streaming
│   ├── Dockerfile
│   └── package.json
├── web/                         # Next.js interactive live dashboard
│   ├── app/                     # React dashboard pages and API proxying
│   ├── components/              # Live pod cards, load panels, call graphs, event feed
│   ├── lib/                     # Real-time state synchronization hooks
│   └── Dockerfile
├── k6/                          # Synthetic traffic simulation scenarios
├── docker-compose.yml           # Local multi-container development composition
└── AGENT.md                     # Engineering conventions and operational guidance
```

---

## Setup Requirements

Before getting started, ensure the following prerequisites are installed on your machine:

- **Docker Desktop** (or Docker Engine with Linux containers enabled)
- **Minikube** (v1.32.0 or newer)
- **kubectl** (Kubernetes command-line tool)
- **Node.js** (v20 LTS or v22) & **npm**

---

## How to Setup

Follow these steps to build and launch the playground from scratch:

### 1. Initialize Minikube

Start Minikube using the Docker driver with recommended resources and enable the required addons:

```bash
minikube start --driver=docker --cpus=3 --memory=3072
minikube addons enable metrics-server
minikube addons enable ingress
```

### 2. Build Container Images

Build the service, backend, and frontend images:

```bash
# Microservices (build versions for release testing)
docker build -t svc-a:blue --build-arg SERVICE_NAME=svc-a --build-arg RELEASE=blue -f services/Dockerfile services/
docker build -t svc-a:green --build-arg SERVICE_NAME=svc-a --build-arg RELEASE=green -f services/Dockerfile services/
docker build -t svc-b:stable --build-arg SERVICE_NAME=svc-b --build-arg RELEASE=stable -f services/Dockerfile services/
docker build -t svc-b:canary --build-arg SERVICE_NAME=svc-b --build-arg RELEASE=canary -f services/Dockerfile services/
docker build -t svc-c:current --build-arg SERVICE_NAME=svc-c --build-arg RELEASE=current -f services/Dockerfile services/
docker build -t svc-c:next --build-arg SERVICE_NAME=svc-c --build-arg RELEASE=next -f services/Dockerfile services/

# Control API Backend
cd control-api && npm run build && docker build -t control-api:v2 . && cd ..

# Web Dashboard
cd web && npm run build && docker build -t web:latest . && cd ..

# Load Generator
docker pull grafana/k6:0.50.0
```

### 3. Load Images into the Minikube Cluster

Transfer the locally built images directly into Minikube's Docker runtime:

```bash
minikube image load svc-a:blue svc-a:green svc-b:stable svc-b:canary svc-c:current svc-c:next control-api:v2 web:latest grafana/k6:0.50.0
```

### 4. Deploy Manifests to Kubernetes

Apply the resource definitions in order:

```bash
# 1. Namespaces
kubectl apply -f k8s/namespaces/

# 2. Microservices, HPAs, and Ingress
kubectl apply -f k8s/apps/svc-a/
kubectl apply -f k8s/apps/svc-b/
kubectl apply -f k8s/apps/svc-c/
kubectl apply -f k8s/apps/ingress-playground.yaml

# 3. Load generator script ConfigMap
kubectl apply -f k8s/loadtest/configmap-k6-script.yaml

# 4. Platform control plane and dashboard
kubectl apply -f k8s/platform/
```

### 5. Access the Dashboard

Forward the dashboard port to your host machine:

```bash
kubectl port-forward -n platform svc/web 3000:3000
```

Open your browser and navigate to:
**`http://localhost:3000`**

---

## What to Expect

Once the dashboard is running, you can interact with the live cluster:

1. **Real-Time Cluster Visibility**:
   - The top navigation bar indicates active cluster connectivity, total pod count, and healthy container status.
   - Individual microservice lanes (`svc-a`, `svc-b`, `svc-c`) render active pod cards showing live CPU consumption, assigned release version, restart counts, and readiness states.
   - On browser refresh, the dashboard immediately synchronizes with the true state of the cluster.

2. **Interactive Load Injection & Dynamic Scaling**:
   - Use the **Load Drivers** control panels to configure target virtual users (VUs), workload duration (ms of CPU burn per request), and routing paths (`/work`, `/chain`, `/fanout`).
   - Click **Start Load** on a service. Within seconds, observe CPU saturation register on the pod cards.
   - When utilization exceeds the 50% target threshold, the Kubernetes Horizontal Pod Autoscaler triggers automatic scale-out, dynamically provisioning new pod replicas in real time.
   - Click **Stop Load** to stop the traffic. After the stabilization window expires, the HPA will automatically scale the service back down to baseline.

3. **Topology & Event Feed**:
   - Inspect the dynamic call graph as requests flow across chained microservice boundaries.
   - Review the lifecycle event stream capturing Kubernetes scaling, scheduling, and pod creation events in chronological order.

---

## License

This project is licensed under the [MIT License](LICENSE).
