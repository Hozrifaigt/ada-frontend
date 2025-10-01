# ADA Frontend - Docker Setup

## Overview
The React frontend application is configured to run entirely within Docker containers, ensuring consistent development and deployment environments.

## Quick Start

### Using Docker Compose (Recommended)

1. **Start the entire application stack:**
   ```bash
   docker-compose up
   ```
   This will start both the API (port 8080) and Frontend (port 3000).

2. **Start only the frontend:**
   ```bash
   docker-compose up frontend
   ```

3. **Rebuild frontend after dependency changes:**
   ```bash
   docker-compose build frontend
   docker-compose up frontend
   ```

### Available Docker Commands

From the project root directory:

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop services
docker-compose down

# Rebuild frontend
docker-compose build frontend

# Force rebuild (no cache)
docker-compose build --no-cache frontend
```

### Using npm scripts (from frontend directory)

```bash
cd frontend

# Docker commands via npm
npm run docker:up       # Start all services
npm run docker:down     # Stop all services
npm run docker:build    # Build images
npm run docker:logs     # View logs
npm run docker:frontend # Start frontend only
npm run docker:rebuild  # Rebuild and start frontend
```

## Development Environment

### Features
- **Hot Reload**: Changes to source files automatically reload in the browser
- **Volume Mounting**: Code is mounted from host, so changes are reflected immediately
- **Node Modules**: Isolated in container to prevent conflicts
- **Environment Variables**: Configured in docker-compose.yml

### Accessing the Application
- Frontend: http://localhost:3000
- API: http://localhost:8080

### File Structure
```
frontend/
├── Dockerfile          # Multi-stage Docker build
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── public/             # Static assets
│   ├── index.html
│   └── manifest.json
└── src/                # Source code
    ├── App.tsx         # Main app component
    ├── index.tsx       # Entry point
    ├── components/     # React components
    ├── pages/          # Page components
    ├── services/       # API services
    ├── types/          # TypeScript types
    └── styles/         # CSS and themes
```

## Environment Configuration

### Required Environment Variables
Set these in `.env` file (copy from `.env.example`):

```env
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_AZURE_CLIENT_ID=your-azure-client-id
REACT_APP_AZURE_TENANT_ID=your-azure-tenant-id
REACT_APP_AZURE_REDIRECT_URI=http://localhost:3000
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs frontend

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache frontend
docker-compose up frontend
```

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

### Hot reload not working
Ensure these environment variables are set in docker-compose.yml:
```yaml
environment:
  - WATCHPACK_POLLING=true
  - CHOKIDAR_USEPOLLING=true
```

### Permission issues
```bash
# Fix permissions if needed
docker-compose exec frontend chown -R node:node /app
```

## Production Build

### Build for production
```bash
# Using Docker
docker build --target production -t ada-frontend:prod ./frontend

# Run production build
docker run -p 80:80 ada-frontend:prod
```

## Next Steps

1. **Azure AD Integration**: Configure your Azure AD application and update `.env`
2. **API Connection**: Ensure the API is running on port 8080
3. **Development**: Start developing by editing files in `src/`
4. **Testing**: Add tests in `src/__tests__/`
5. **Deployment**: Build production image and deploy