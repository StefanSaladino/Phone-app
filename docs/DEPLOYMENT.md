# Free Netlify deployment

## Recommended Git workflow

1. Push the clean repository to a private GitHub repository.
2. In Netlify, choose **Add new project** and import the GitHub repository.
3. Netlify reads `netlify.toml`, so the build command is `npm run build` and the publish directory is `dist`.
4. Add these environment variables in the Netlify project settings:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

5. Trigger a deployment.
6. Open the generated `*.netlify.app` URL and test both accounts.

The generated Netlify subdomain is sufficient; purchasing a custom domain is not required.

## Supabase authentication URL

Add the final Netlify URL to the allowed Auth URL configuration in Supabase. Keep the local Vite URL available for development.

Typical values are:

```text
Site URL: https://YOUR-SITE.netlify.app
Additional redirect URL: http://localhost:5173/**
```

Together currently uses password sign-in and does not rely on an email redirect during ordinary login, but keeping the production URL correct prevents future invitation or password-reset links from pointing to localhost.

## Disable public signup

After both approved users exist, disable new user registration in Supabase Authentication settings. Do not delete either existing account.

## iPhone installation

On each iPhone:

1. Open the production URL in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Keep the name **Together** and tap **Add**.
5. Open the new Home Screen icon and sign in.
