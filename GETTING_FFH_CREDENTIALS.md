# How to Get FFH API Credentials

## Method 1: Browser DevTools (Easiest)

1. Go to https://www.fantasyfootballhub.co.uk/
2. Log into your account
3. Open browser DevTools (F12)
4. Go to the "Network" tab
5. Navigate to any page with player data
6. Look for requests to `data.fantasyfootballhub.co.uk/api`
7. Click on one of those requests
8. In the "Headers" section, look for:
   - `Authorization: <your FFH_AUTH_STATIC value>`
   - `Token: <your FFH_BEARER_TOKEN value>`

## Method 2: From the previous hardcoded value

You had this value hardcoded (which we removed):
- FFH_AUTH_STATIC: 'r5C(e3.JeS^:_7LF'

If this was working for you before, you can use it again in .env.local.
For the bearer token, you'll need to check your browser requests.

## Once you have the values:

Create `.env.local` in the project root:

```bash
SLEEPER_LEAGUE_ID=1240184286171107328
FFH_AUTH_STATIC=your_actual_auth_token_here
FFH_BEARER_TOKEN=your_actual_bearer_token_here
```

Then restart your dev server.
