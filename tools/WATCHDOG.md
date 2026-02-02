# Maxwell AI Watchdog Configuration

## Environment Variables

Set these environment variables to configure the watchdog:

### Required
- `GITHUB_TOKEN` - GitHub personal access token with repo permissions

### Optional
- `NODE_ENV` - Set to 'development' for dry-run mode
- `WATCHDOG_LOG_LEVEL` - debug, info, warn, error (default: info)

## Usage

### Development (Dry Run)
```bash
NODE_ENV=development npm run watchdog
```

### Production
```bash
GITHUB_TOKEN=your_token npm run watchdog
```

## What it monitors

1. **Service Performance** - Response times and availability of Render services
2. **Security Vulnerabilities** - npm audit for critical/high vulnerabilities
3. **Resource Usage** - Render free tier limits monitoring

## Issue Management

- Creates new issues for new problems
- Comments on existing similar issues
- Limits: max 5 issues per day to avoid flooding
- Smart similarity detection to avoid duplicates

## Labels

Issues are automatically labeled with:
- `performance`, `security`, `availability` - Problem type
- `error`, `warning` - Severity level  
- `maxwell-watchdog` - Auto-generated tag

## Example Issues

The watchdog will create issues like:

```
🐌 Slow response: Maxwell-AI-Support

Response time: 8500ms (threshold: 5000ms)

Recommendation: Check service health and consider optimization
```

## Integration with Maxwell

The watchdog can be integrated into the main Maxwell AI Support server for continuous monitoring.
