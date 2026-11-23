# Contributing to Kube Playground

Thank you for your interest in contributing to Kube Playground!

## How to Contribute

1. **Fork & Branch**: Create a feature branch from `main` or `master`.
2. **Local Development**:
   - Ensure local tests pass: `npm test` inside `services/`.
   - Verify TypeScript compilation: `npm run build` inside `control-api/` and `web/`.
3. **Kubernetes Manifest Guidelines**:
   - All workloads must run as non-root with security contexts configured.
   - Resource requests and limits must be explicitly declared on all Pods.
   - Separate business logic into `k8s/apps/` and administrative/telemetry components into `k8s/platform/`.
4. **Pull Requests**:
   - Provide a clear description of changes.
   - Detail the verification steps performed in your local Minikube cluster.
