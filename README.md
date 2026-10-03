# Polling & Voting App

Create polls, share the link, vote, and watch results update live.

**Stack:** React (Vite) · Node.js + Express · Prisma ORM · SQLite. Express serves the built React app, so the whole thing ships as one container.

## Features
- Create a poll with a question and 2–6 options and an expiry date
- Shareable public poll URL (`/polls/:id`)
- One vote per browser (cookie) and per IP (hashed) per poll
- Live results with percentage bars, auto-refreshing every 5 seconds
- Expired polls are closed and show final results only
- Home page with trending (most votes) and recent polls
- Client + server validation, `/health` endpoint, structured JSON logs on stdout

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/polls` | Create a poll `{question, options[], expiresAt?}` |
| GET | `/api/polls` | `{recent[], trending[]}` |
| GET | `/api/polls/:id` | Poll details, results, `hasVoted` |
| POST | `/api/polls/:id/vote` | Cast a vote `{optionId}` (409 if already voted / closed) |
| GET | `/health` | 200 when app and database are reachable |

## Run locally (development)
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev      # creates data/polls.db
npm run dev                 # API on :3000

cd ../frontend
npm install
npm run dev                 # UI on :5173 (proxies /api to :3000)
```
Run the API tests: `cd backend && npm test`

## Run with Docker Compose
```bash
cp .env.example .env        # optional: change HOST_PORT / VOTER_HASH_SALT
docker compose up --build
```
Open http://localhost:8080. Data lives in the named volume `polls-data` and survives restarts.
Teardown: `docker compose down` (add `-v` to delete the data).

## Deploy to Kubernetes
Works on a single-node local cluster (Docker Desktop, minikube, kind). The 2+ app replicas share one SQLite file on a PVC (WAL mode), which is why this is limited to a single node.

```bash
docker build -t polling-voting-app:latest .
# minikube: minikube image load polling-voting-app:latest
# kind:     kind load docker-image polling-voting-app:latest

kubectl apply -f k8s/
kubectl get all -n polling-voting-app
```
Open http://localhost:30080 (on minikube use `minikube service app-nodeport -n polling-voting-app --url`), or:
```bash
kubectl port-forward svc/app 8080:80 -n polling-voting-app
```
Useful commands:
```bash
kubectl logs deploy/app -n polling-voting-app
kubectl scale deploy/app --replicas=3 -n polling-voting-app
kubectl delete pod <one-pod-name> -n polling-voting-app   # site stays up via the other replica
kubectl delete ns polling-voting-app      # teardown
```

## Layout
```
backend/      Express API, Prisma schema + migrations, tests, entrypoint
frontend/     React (Vite) UI
Dockerfile    multi-stage: build UI -> install deps -> slim non-root runtime
docker-compose.yml
k8s/          namespace, configmap, secret, pvc, deployment, services
```

## Notes and decisions
- **Trending** = open polls ranked by total votes, ties broken by newest.
- **Duplicate prevention** is basic by design: clearing cookies *and* changing IP bypasses it. Users behind one shared IP (e.g. an office NAT) count as one voter.
- **SQLite + replicas** is a deliberate trade-off for a demo; for multi-node production use PostgreSQL.
- The Secret holds a salt for hashing voter IPs; the value in `k8s/secret.yaml` is a demo placeholder.
