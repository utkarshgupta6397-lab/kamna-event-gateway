# Development Guide

Welcome to the Kamna Event Gateway development guide.

## Setup
Ensure you have Node.js 22 LTS installed.
1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Run `npm run dev` to start the server with hot-reload.

## Code Quality
We enforce strict TypeScript configurations and ESLint rules. 
- Run `npm run lint` before committing to ensure there are no implicit `any` types or unused variables.
- Run `npm run format` to ensure Prettier formatting is applied.

## Testing
We use Vitest for unit and integration testing.
- Write tests in the `tests/` directory with the `.test.ts` extension.
- Run `npm run test` to execute the suite.

## Adding New Features
Always ensure new features align with the core principle of remaining business-logic agnostic. If you find yourself hardcoding platform-specific details (like WhatsApp IDs), the feature does not belong in this repository.
