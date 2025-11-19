# GitHub Pages Deployment Guide

This guide will help you deploy the Watermark Remover app to GitHub Pages.

## Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/olderthantheinternet/watermark-remover
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Source**: `GitHub Actions`
5. Click **Save**

## Step 2: Add GitHub Secret for API Key

1. In your repository, go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VITE_SEGMIND_API_KEY`
4. Value: Your Segmind API key (e.g., `SG_03e4ec0d6e508d91`)
5. Click **Add secret**

## Step 3: Deploy

The GitHub Actions workflow will automatically deploy when you:
- Push to the `master` branch
- Or manually trigger it from the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

## Step 4: Access Your Deployed App

Once deployed, your app will be available at:
**https://olderthantheinternet.github.io/watermark-remover/**

## Troubleshooting

- **Build fails**: Check the **Actions** tab for error logs
- **API key not working**: Verify the secret is set correctly in Settings → Secrets
- **Page not loading**: Make sure GitHub Pages is enabled and using GitHub Actions as the source

## Manual Deployment

If you want to deploy manually:

```bash
# Build the project
npm run build

# The dist/ folder contains the built files
# You can deploy these to any static hosting service
```

