# Vercel Deployment Guide

This guide will help you deploy your crypto trading dashboard to Vercel.

## Prerequisites

- [ ] GitHub account
- [ ] Vercel account (free tier works)
- [ ] Supabase account with PostgreSQL database
- [ ] OpenAI API key
- [ ] CryptoPanic API token

---

## Step 1: Database Setup (Supabase)

### 1.1 Get Your Database Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Settings** → **Database**
4. Under **Connection string**, select **URI**
5. Copy the connection string (format: `postgresql://postgres:password@host:5432/postgres`)
6. **Important**: Save this for Step 3

### 1.2 Verify Database Tables

The database schema was already pushed using `drizzle-kit push`. Your Supabase database should have these tables:
- `portfolio_positions`
- `watchlist`
- `scan_history`
- `trade_transactions`
- `ai_analysis`
- `market_data`
- `alerts`

You can verify in Supabase Dashboard → **Table Editor**.

---

## Step 2: Push Code to GitHub

If you haven't already pushed your code to GitHub:

```bash
# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Commit changes
git commit -m "Migrate to Vercel with PostgreSQL database"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main
```

---

## Step 3: Deploy to Vercel

### 3.1 Import Project

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Vercel will auto-detect your project settings

### 3.2 Configure Environment Variables

Before deploying, add these environment variables in Vercel:

1. Click **Environment Variables**
2. Add each variable:

#### Required Variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `DATABASE_URL` | `postgresql://postgres:...` | Supabase Dashboard → Database → Connection String |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON` | `eyJhbGci...` | Supabase Dashboard → Settings → API → anon public |
| `OPENAI_API_KEY` | `sk-proj-...` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `CRYPTOPANIC_TOKEN` | Your token | [CryptoPanic API](https://cryptopanic.com/developers/api/) |

#### Optional Variables (if using Firebase):

| Variable Name | Where to Get It |
|--------------|-----------------|
| `FIREBASE_PROJECT_ID` | Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | Service Account JSON |
| `FIREBASE_PRIVATE_KEY` | Service Account JSON |

### 3.3 Deploy

1. Click **Deploy**
2. Wait for build to complete (2-3 minutes)
3. Vercel will provide you with a live URL: `https://your-app.vercel.app`

---

## Step 4: Verify Deployment

### 4.1 Test Your App

1. Visit your Vercel deployment URL
2. Test the following:
   - [ ] Homepage loads
   - [ ] Sign up / Login works (Supabase auth)
   - [ ] Dashboard displays
   - [ ] Portfolio can add/remove positions
   - [ ] Watchlist works
   - [ ] Market data loads (Binance API works outside Replit!)

### 4.2 Check Build Logs

If something doesn't work:
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click latest deployment
3. Check **Build Logs** and **Function Logs**

---

## Step 5: Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your custom domain
3. Update your DNS records as instructed
4. Vercel will auto-provision SSL certificate

---

## Architecture Notes

### What Changed for Vercel

✅ **Database**: SQLite → PostgreSQL (Supabase)
✅ **Routing**: Hash-based routing with Wouter (works on Vercel)
✅ **API**: Serverless functions in `/api` directory
✅ **Storage**: Persistent PostgreSQL database (no in-memory fallback needed)

### How It Works

**Development (Replit)**:
- Express server on port 5000
- PostgreSQL via DATABASE_URL
- Vite HMR for hot reload

**Production (Vercel)**:
- Serverless functions (`/api/*`)
- PostgreSQL via DATABASE_URL
- Static SPA served from `/public`
- Automatic CDN caching

---

## Troubleshooting

### Build Failures

**Error: "Cannot find module '@shared/schema'"**
- This is a TypeScript path resolution issue
- The app will still build and run correctly
- To fix: Add a `tsconfig.server.json` (optional, doesn't affect runtime)

**Error: "DATABASE_URL is required"**
- Make sure you added DATABASE_URL in Vercel environment variables
- Redeploy after adding the variable

### Runtime Errors

**"AI not configured" error**
- Check that OPENAI_API_KEY is set in Vercel
- Verify your OpenAI account has credits

**Binance API errors**
- This is expected on Replit (geo-blocked)
- Should work fine on Vercel deployment

**Database connection errors**
- Verify DATABASE_URL format includes `?sslmode=require`
- Check Supabase database is running
- Verify connection string has correct password

---

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Deploy to Vercel
3. ✅ Configure environment variables
4. ✅ Test deployment
5. 🎉 Share your live URL!

---

## Support

If you encounter issues:
1. Check Vercel Function Logs
2. Check Supabase database logs
3. Review browser console for frontend errors
4. Verify all environment variables are set

## Notes

- **Binance API**: Works on Vercel (only blocked on Replit)
- **Mobile Optimization**: Already implemented for all pages
- **Database**: Persistent PostgreSQL storage
- **Auth**: Supabase authentication (Firebase optional)
