#!/usr/bin/env node

/**
 * Maxwell AI Watchdog System - Versione Semplice
 * Monitoraggio intelligente con gestione issue GitHub
 */

const https = require('https');
const { spawn } = require('child_process');

// Configurazione
const CONFIG = {
  repo: 'Heartran/Turni-di-Palco',
  scanInterval: 60 * 60 * 1000, // 1 ora
  maxIssuesPerDay: 5,
  dryRun: process.env.NODE_ENV === 'development',
  logLevel: process.env.WATCHDOG_LOG_LEVEL || 'info'
};

// Stato del watchdog
let watchdogState = {
  lastScan: null,
  issuesCreated: 0,
  issuesCommented: 0,
  dailyIssues: []
};

// Logger
function log(level, message, data = null) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[CONFIG.logLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [WATCHDOG-${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
    if (data) console.log('  Data:', JSON.stringify(data, null, 2));
  }
}

// GitHub API helper
class GitHubAPI {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.baseUrl = 'https://api.github.com';
  }

  async request(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      const options = {
        method,
        headers: {
          'Authorization': `token ${this.token}`,
          'User-Agent': 'Maxwell-Watchdog/1.0',
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`GitHub API error: ${res.statusCode} - ${result.message}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getIssues(state = 'open') {
    try {
      const issues = await this.request('GET', `/repos/${CONFIG.repo}/issues?state=${state}`);
      return issues.filter(issue => !issue.pull_request);
    } catch (error) {
      log('error', 'Failed to fetch issues', { error: error.message });
      return [];
    }
  }

  async createIssue(title, body, labels = []) {
    if (CONFIG.dryRun) {
      log('info', '[DRY RUN] Would create issue', { title, labels });
      return { id: 'dry-run', number: 'dry-run' };
    }

    try {
      const issue = await this.request('POST', `/repos/${CONFIG.repo}/issues`, {
        title,
        body,
        labels
      });
      return issue;
    } catch (error) {
      log('error', 'Failed to create issue', { title, error: error.message });
      throw error;
    }
  }

  async addComment(issueNumber, body) {
    if (CONFIG.dryRun) {
      log('info', '[DRY RUN] Would add comment to issue #' + issueNumber, { body: body.substring(0, 100) + '...' });
      return { id: 'dry-run' };
    }

    try {
      const comment = await this.request('POST', `/repos/${CONFIG.repo}/issues/${issueNumber}/comments`, {
        body
      });
      return comment;
    } catch (error) {
      log('error', 'Failed to add comment', { issueNumber, error: error.message });
      throw error;
    }
  }
}

// Detector di problemi
class ProblemDetector {
  async detectProblems() {
    const problems = [];

    // 1. Monitoraggio performance servizi Render
    const renderProblems = await this.checkRenderPerformance();
    problems.push(...renderProblems);

    // 2. Check dipendenze di sicurezza
    const securityProblems = await this.checkSecurity();
    problems.push(...securityProblems);

    return problems;
  }

  async checkRenderPerformance() {
    const problems = [];
    const services = [
      { name: 'Maxwell-AI-Support', url: 'https://maxwell-ai-support.onrender.com/health' },
      { name: 'Turni-di-Palco', url: 'https://turni-di-palco-fq85.onrender.com/health' }
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(service.url);
        const responseTime = Date.now() - startTime;

        if (responseTime > 5000) {
          problems.push({
            type: 'performance',
            severity: 'warning',
            title: `Slow response: ${service.name}`,
            details: `Response time: ${responseTime}ms (threshold: 5000ms)`,
            data: { service: service.name, responseTime, url: service.url },
            suggestion: 'Check service health and consider optimization'
          });
        }

        if (response.status !== 200) {
          problems.push({
            type: 'availability',
            severity: 'error',
            title: `Service down: ${service.name}`,
            details: `HTTP ${response.status} from ${service.url}`,
            data: { service: service.name, status: response.status, url: service.url },
            suggestion: 'Immediate investigation required'
          });
        }
      } catch (error) {
        problems.push({
          type: 'availability',
          severity: 'error',
          title: `Service unreachable: ${service.name}`,
          details: `Failed to connect: ${error.message}`,
          data: { service: service.name, error: error.message, url: service.url },
          suggestion: 'Check service status and Render dashboard'
        });
      }
    }

    return problems;
  }

  async checkSecurity() {
    const problems = [];
    
    try {
      const result = spawnSync('npm', ['audit', '--json'], { 
        encoding: 'utf8',
        cwd: process.cwd()
      });

      if (result.stdout) {
        const audit = JSON.parse(result.stdout);
        const vulnerabilities = audit.vulnerabilities || {};

        Object.entries(vulnerabilities).forEach(([pkg, info]) => {
          if (info.severity === 'critical' || info.severity === 'high') {
            problems.push({
              type: 'security',
              severity: info.severity === 'critical' ? 'error' : 'warning',
              title: `Security vulnerability: ${pkg}`,
              details: `${info.severity} severity - ${info.title}`,
              data: { package: pkg, severity: info.severity },
              suggestion: `Run 'npm audit fix' or update ${pkg} to safe version`
            });
          }
        });
      }
    } catch (error) {
      log('warn', 'Failed to run security audit', { error: error.message });
    }

    return problems;
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 10000 }, (res) => {
        resolve({ status: res.statusCode });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }
}

// Gestore intelligente delle issue
class IssueManager {
  constructor() {
    this.github = new GitHubAPI();
  }

  async processProblems(problems) {
    const existingIssues = await this.github.getIssues();
    const results = { created: 0, commented: 0 };

    for (const problem of problems) {
      try {
        const similarIssue = this.findSimilarIssue(problem, existingIssues);
        
        if (similarIssue) {
          await this.commentOnIssue(similarIssue, problem);
          results.commented++;
        } else {
          if (this.shouldCreateIssue(problem)) {
            await this.createNewIssue(problem);
            results.created++;
          }
        }
      } catch (error) {
        log('error', 'Failed to process problem', { problem: problem.title, error: error.message });
      }
    }

    return results;
  }

  findSimilarIssue(problem, existingIssues) {
    return existingIssues.find(issue => {
      const titleSimilarity = this.calculateSimilarity(problem.title, issue.title);
      const sameType = issue.labels.some(label => label.name === problem.type);
      
      return titleSimilarity > 0.7 || (sameType && titleSimilarity > 0.5);
    });
  }

  calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  shouldCreateIssue(problem) {
    if (watchdogState.dailyIssues.length >= CONFIG.maxIssuesPerDay) {
      log('warn', 'Daily issue limit reached', { limit: CONFIG.maxIssuesPerDay });
      return false;
    }
    return true;
  }

  async createNewIssue(problem) {
    const body = this.generateIssueBody(problem);
    const labels = [problem.type, problem.severity, 'maxwell-watchdog'];

    const issue = await this.github.createIssue(problem.title, body, labels);
    
    watchdogState.issuesCreated++;
    watchdogState.dailyIssues.push({
      timestamp: Date.now(),
      title: problem.title,
      type: problem.type
    });

    log('info', 'Created new issue', { 
      title: problem.title, 
      number: issue.number,
      severity: problem.severity 
    });

    return issue;
  }

  async commentOnIssue(existingIssue, problem) {
    const comment = this.generateUpdateComment(problem);
    
    await this.github.addComment(existingIssue.number, comment);
    
    watchdogState.issuesCommented++;

    log('info', 'Added comment to existing issue', { 
      number: existingIssue.number,
      title: existingIssue.title 
    });

    return existingIssue;
  }

  generateIssueBody(problem) {
    return `## 🤖 Maxwell AI Watchdog Alert

**Type:** ${problem.type}  
**Severity:** ${problem.severity}  
**Detected:** ${new Date().toISOString()}

### 📋 Problem Details
${problem.details}

### 📊 Additional Data
\`\`\`json
${JSON.stringify(problem.data, null, 2)}
\`\`\`

### 💡 Maxwell's Recommendation
${problem.suggestion}

### 🎯 Next Steps
- [ ] Investigate the root cause
- [ ] Implement the suggested fix
- [ ] Monitor for recurrence

---
*This issue was automatically created by Maxwell AI Watchdog System.*`;
  }

  generateUpdateComment(problem) {
    return `🤖 **Maxwell Update** - ${new Date().toISOString()}

**New occurrence detected:**
- ${problem.details}

**Recommendation:** ${problem.suggestion}

---
*This comment was automatically generated by Maxwell AI Watchdog.*`;
  }
}

// Main Watchdog class
class MaxwellWatchdog {
  constructor() {
    this.detector = new ProblemDetector();
    this.issueManager = new IssueManager();
  }

  async run() {
    log('info', '🐕 Maxwell AI Watchdog starting scan...');
    
    try {
      this.resetDailyCounterIfNeeded();

      const problems = await this.detector.detectProblems();
      log('info', `Detected ${problems.length} potential problems`);

      if (problems.length > 0) {
        const results = await this.issueManager.processProblems(problems);
        
        log('info', 'Scan completed', {
          problems: problems.length,
          issuesCreated: results.created,
          issuesCommented: results.commented
        });
      } else {
        log('info', '✅ No problems detected - All systems operational');
      }

      watchdogState.lastScan = new Date();

    } catch (error) {
      log('error', 'Watchdog scan failed', { error: error.message });
    }
  }

  resetDailyCounterIfNeeded() {
    const today = new Date().toDateString();
    const lastReset = watchdogState.lastReset;

    if (!lastReset || new Date(lastReset).toDateString() !== today) {
      watchdogState.dailyIssues = [];
      watchdogState.lastReset = new Date();
      log('info', 'Daily issue counter reset');
    }
  }

  async start() {
    log('info', '🚀 Maxwell AI Watchdog System starting...');
    log('info', 'Configuration', { 
      repo: CONFIG.repo,
      scanInterval: CONFIG.scanInterval / 1000 / 60,
      dryRun: CONFIG.dryRun
    });

    await this.run();

    setInterval(async () => {
      await this.run();
    }, CONFIG.scanInterval);

    log('info', `⏰ Next scan scheduled in ${CONFIG.scanInterval / 1000 / 60} minutes`);
  }
}

// Helper function for sync processes
function spawnSync(command, args, options = {}) {
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, encoding: 'utf8' });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => stdout += data);
    child.stderr?.on('data', (data) => stderr += data);

    child.on('close', (code) => {
      resolve({ stdout, stderr, status: code });
    });
  });
}

// Start if run directly
if (require.main === module) {
  const watchdog = new MaxwellWatchdog();
  
  process.on('SIGINT', () => {
    log('info', '🛑 Maxwell Watchdog shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('info', '🛑 Maxwell Watchdog terminating...');
    process.exit(0);
  });

  watchdog.start().catch(error => {
    log('error', '💥 Failed to start watchdog', { error: error.message });
    process.exit(1);
  });
}

module.exports = { MaxwellWatchdog, ProblemDetector, IssueManager };
