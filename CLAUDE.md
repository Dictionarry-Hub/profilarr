# Profilarr Development Guide

## Commands
- **Frontend**: `cd frontend && npm run dev` - Start React dev server
- **Backend**: `cd backend && gunicorn -b 0.0.0.0:5000 app.main:app` - Run Flask server
- **Docker**: `docker compose up` - Start both frontend/backend in dev mode
- **Lint**: `cd frontend && npx eslint 'src/**/*.{js,jsx}'` - Check frontend code style
- **Build**: `cd frontend && npm run build` - Build for production

## Code Style
### Frontend (React)
- **Imports**: React first, third-party libs next, components, then utils
- **Components**: Functional components with hooks, PascalCase naming
- **Props**: PropTypes for validation, destructure props in component signature
- **State**: Group related state, useCallback for memoized handlers
- **JSX**: 4-space indentation, attributes on new lines for readability
- **Error Handling**: try/catch for async operations, toast notifications

### Backend (Python)
- **Imports**: Standard lib first, third-party next, local modules last
- **Naming**: snake_case for functions/vars/files, PascalCase for classes
- **Functions**: Single responsibility, descriptive docstrings
- **Error Handling**: Specific exception catches, return (success, message) tuples
- **Indentation**: 4 spaces consistently
- **Modularity**: Related functionality grouped in directories