# Versatile Training Hub

**Live Hub:** [**https://versatile-training-hub.vercel.app/**](https://versatile-training-hub.vercel.app/)

A web platform for the Rocket League community to share, discover, download, and manage custom training packs, designed for use with the [VersatileTraining BakkesMod plugin](https://github.com/abdurisaq/VersatileTraining).

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Related Project](#related-project)
- [User Guide](#user-guide)
  - [Plugin Requirement](#plugin-requirement)
  - [Finding and Using Packs](#finding-and-using-packs)
  - [Uploading & Managing Your Packs](#uploading--managing-your-packs)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database](#database)
  - [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Overview 

The Versatile Training Hub serves as a repository for custom Rocket League training packs. It enables users to browse packs shared by the community, load them directly into their game (via the companion BakkesMod plugin), and upload their own creations. The platform also supports detailed shot data viewing for compatible packs.

[![Watch the demo video here](https://img.youtube.com/vi/9eDVzMzTQ7c/0.jpg)](https://www.youtube.com/watch?v=9eDVzMzTQ7c)




## Key Features

*   **Centralized Training Pack Repository:**
    *   Platform for users to share, discover, and download custom Rocket League training packs.
    *   Displays detailed pack information including name, creator, difficulty (visualized with ranks), official in-game code, number of shots, user-defined tags, and visibility status.

*   **Direct BakkesMod Plugin Integration (VersatileTraining):**
    *   **Upload from Game:** Enables users to upload their local training packs directly from the Rocket League client (plugin connects via port `7437` with auth token `versatile_training_scanner_token`) to the Hub.
    *   **Load to Game:** Allows one-click loading of training packs from the Hub directly into the Rocket League game client.
    *   **Update from Game:** Supports updating existing pack data on the Hub with the latest versions from the in-game plugin (see `src/app/training-packs/[id]/update/page.tsx`).

*   **Advanced Shot Data Decoding & Display:**
    *   Decodes compressed training pack metadata (`packMetadataCompressed`) to display detailed per-shot information.
    *   The decoding logic (see `decodeTrainingPack` in `src/app/training-packs/[id]/page.tsx`) extracts data like boost amount, starting velocities, angular velocities, car freeze status, jump status, and goal blocker configurations.

*   **User Account System (NextAuth.js):**
    *   Provides user registration and authentication for managing uploaded packs.
    *   Creators can edit metadata (see `src/app/training-packs/[id]/edit/page.tsx`) and delete their training pack submissions.

*   **Pack Interaction & Management:**
    *   **Downloadable Packs:** Users can download pack data as `.json` files.
    *   **User Feedback:** Supports pack ratings, comments with replies (see `src/app/training-packs/[id]/page.tsx` for comment UI and `handleAddReply`), and a favorites system. tRPC mutations handle these interactions (e.g., `toggleFavorite`, `submitOrUpdateRating`, `addComment`).

*   **Integrated Hub Guide:**
    *   Offers an in-app guide (`src/app/hub-guide/page.tsx`) for using the Hub and its plugin-dependent features.

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **API:** tRPC
*   **ORM:** Prisma
*   **Database:** PostgreSQL (Supabase for live deployment)
*   **Authentication:** NextAuth.js
*   **Styling:** Tailwind CSS (see `src/styles/globals.css`)
*   **Deployment:** Vercel

## Related Project

*   **VersatileTraining BakkesMod Plugin:** [https://github.com/abdurisaq/VersatileTraining](https://github.com/abdurisaq/VersatileTraining)
    *   This companion plugin is **required** for features like uploading local packs, direct game loading, and in-game updates.

## User Guide

Access the live platform at [https://versatile-training-hub.vercel.app/](https://versatile-training-hub.vercel.app/).

### Plugin Requirement

For features like direct pack loading into your game or uploading your local packs, the VersatileTraining BakkesMod plugin must be installed and running with Rocket League. Download and installation instructions are available on the plugin's GitHub page and the [Hub Guide](https://versatile-training-hub.vercel.app/hub-guide).

### Finding and Using Packs

*   **Browse:** Navigate to "Browse Packs" to find public training packs.
*   **Details:** Click a pack to view its details, shot data (if available), ratings, and comments.
*   **Load to Game:** If the plugin is active, use the "Load in Game" button on a pack's page.
*   **Download:** Download the pack's `.json` file for manual use.

### Uploading & Managing Your Packs

1.  **Login:** Sign up or log in to your Hub account.
2.  **Plugin Active:** Ensure Rocket League is running with the VersatileTraining plugin.
3.  **Upload Page:** Go to "Upload Pack". The Hub will attempt to list your local packs from the plugin.
4.  **Select & Detail:** Choose a pack, fill in its metadata (name, description, code, difficulty, tags, visibility).
5.  **Submit:** Upload the training pack.
6.  **Manage:** Edit details or update pack data from the plugin via your pack's page on the Hub.

For detailed instructions, refer to the [Hub Guide](https://versatile-training-hub.vercel.app/hub-guide).

## Development Setup

### Prerequisites

*   Node.js (v18.x or later)
*   npm, yarn, or pnpm
*   PostgreSQL database instance

### Installation

1.  **Clone:**
    ```bash
    git clone https://github.com/abdurisaq/VersatileTrainingHub.git
    cd VersatileTrainingHub
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    # or yarn install / pnpm install
    ```

### Environment Variables

Create a `.env` file in the project root. Refer to `src/env.js` for the schema. Essential variables include:

```env
# Database connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# NextAuth.js
NEXTAUTH_SECRET="your_random_secret_string" # Generate with `openssl rand -hex 32`
NEXTAUTH_URL="http://localhost:3000"      # For local development

# Node environment
NODE_ENV="development"
```
Set `SKIP_ENV_VALIDATION=true` to bypass validation if needed (e.g., Docker builds).

### Database

Ensure your PostgreSQL server is running and `DATABASE_URL` is correctly set.
Apply migrations:
```bash
npx prisma migrate dev
```
To seed data (if `prisma/seed.ts` is configured):
```bash
npx prisma db seed
```

### Running Locally
```bash
npm run dev
# or yarn dev / pnpm dev
```
The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

*   `prisma/`: Database schema (`schema.prisma`) and migrations.
*   `public/`: Static assets.
*   `src/app/`: Next.js App Router (pages, layouts, route-specific components).
    *   `src/app/api/`: HTTP API route handlers (e.g., plugin communication).
*   `src/components/`: Shared React components.
*   `src/hooks/`: Custom React hooks (e.g., `usePluginConnection.ts`).
*   `src/lib/`: General utility functions.
*   `src/server/`: Server-side logic.
    *   `src/server/api/`: tRPC routers (`root.ts`, `trpc.ts`) and procedures.
    *   `src/server/auth.ts`: NextAuth.js configuration.
    *   `src/server/db.ts`: Prisma client instance.
*   `src/env.js`: Environment variable schema and validation.
*   `eslint.config.js`: ESLint configuration.

## API Endpoints

*   **tRPC:** Primary API for client-server data fetching and mutations, defined in `src/server/api/routers/`.
*   **Plugin Upload:** `POST /api/plugin/upload` - HTTP endpoint for the BakkesMod plugin to upload training pack data. Requires authentication.

## Contributing

Contributions are welcome. Please follow standard fork-and-pull-request workflow:
1.  Fork the repository.
2.  Create a feature or bugfix branch.
3.  Commit your changes with clear messages.
4.  Push to your fork and open a Pull Request.

## License

This project is licensed under the MIT License. (Create a `LICENSE.md` file with the MIT License text if one doesn't exist).