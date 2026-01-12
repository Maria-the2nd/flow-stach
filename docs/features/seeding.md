# Seeding Demo Data

How to populate the Convex database with demo assets for development and testing.

## Running the Seed

### Prerequisites

1. Convex dev server running:
   ```bash
   bunx convex dev
   ```

2. Your user must have `role: "admin"` in the `users` table.

### Option 1: Convex Dashboard

1. Open [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Functions** tab
4. Find `admin:seedDemoData`
5. Click **Run** (no arguments needed)

### Option 2: CLI (requires admin auth)

```bash
bunx convex run admin:seedDemoData
```

**Note:** This requires you to be authenticated as an admin user.

## What Gets Created

### Assets (18 total)

| Category | Slugs |
|----------|-------|
| cursor | `magnetic-cursor-effect`, `custom-cursor-trails` |
| scroll | `smooth-scroll-anchor`, `parallax-scroll-sections` |
| buttons | `animated-cta-button`, `gradient-border-button` |
| navigation | `mobile-nav-drawer`, `mega-menu-dropdown` |
| hover | `card-hover-tilt`, `image-hover-zoom` |
| media | `video-background-hero`, `image-gallery-lightbox` |
| typography | `animated-text-reveal`, `gradient-text-effect` |
| utilities | `copy-to-clipboard`, `dark-mode-toggle` |
| sections | `hero-split-section`, `testimonial-carousel` |

Each asset includes:
- `slug`, `title`, `category`, `description`
- `tags[]` for search
- `previewImageUrl` or `previewVideoUrl` (placeholder images)
- `status: "published"`
- `isNew: true/false`
- `createdAt`, `updatedAt` timestamps

### Payloads (18 total)

Each asset gets a corresponding payload stub:
- `webflowJson`: `{"placeholder": true}`
- `codePayload`: `// {Title}\n// TODO: Add implementation`
- `dependencies`: `[]`

## Expected Results

After running `seedDemoData`:

1. **Browse page** (`/assets`): Shows 18 asset cards
2. **Category filter** (`/assets?cat=cursor`): Shows 2 cursor assets
3. **Detail page** (`/assets/magnetic-cursor-effect`): Shows asset with payload info
4. **Search**: Typing "button" shows 2 results

## Idempotency

The seed function is idempotent:
- Checks for existing slugs before inserting
- Running multiple times won't create duplicates
- Returns count of newly created items

```json
{ "assets": 18, "payloads": 18 }  // First run
{ "assets": 0, "payloads": 0 }    // Subsequent runs
```

## Troubleshooting

### "Not an admin" error

Your user doesn't have admin role. Fix via Convex Dashboard:

1. Go to **Data** tab
2. Open `users` table
3. Find your user (by `clerkId`)
4. Edit `role` to `"admin"`

### Assets not appearing

1. Check Convex Dashboard **Data** tab for `assets` table
2. Verify `status` is `"published"` (not `"draft"`)
3. Check browser console for Convex query errors
4. Ensure you're authenticated (Clerk sign-in)

### "Unauthenticated" error

The seed mutation requires authentication:
1. Sign in to the app first
2. Make sure your Clerk user exists in Convex `users` table
3. Try running from the Dashboard instead of CLI

### Payloads missing

Check the `payloads` table in Dashboard. Each payload should have:
- `assetId` matching an asset's `_id`
- `webflowJson` and `codePayload` fields

## Resetting Data

To clear and re-seed:

1. Go to Convex Dashboard **Data** tab
2. Delete all documents from `assets` table
3. Delete all documents from `payloads` table
4. Run `seedDemoData` again
