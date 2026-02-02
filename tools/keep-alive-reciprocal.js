#!/usr/bin/env node

/**
 * Keep-Alive Reciproco per servizi Render Free Tier
 * Mantiene attivi Maxwell-AI-Support e Turni-di-Palco facendosi ping a vicenda
 */

const http = require('http');
const https = require('https');

// Configurazione
const SERVICES = {
  maxwell: 'https://maxwell-ai-support.onrender.com',
  turni: 'https://turni-di-palco-fq85.onrender.com'
};

const INTERVAL_MS = 10 * 60 * 1000; // 10 minuti (sotto i 15 di sleep di Render)
const TIMEOUT_MS = 30000; // 30 secondi timeout
const JITTER_MS = 60000; // 1 minuto di jitter per evitare sincronizzazione

// Stato del keep-alive
let lastPing = {
  maxwell: null,
  turni: null
};

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          duration: Date.now() - startTime,
          success: res.statusCode === 200,
          data: data.trim()
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        url,
        status: 'ERROR',
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        status: 'TIMEOUT',
        duration: Date.now() - startTime,
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function performKeepAlive() {
  log('🔄 Inizio keep-alive reciproco...');
  
  try {
    // Maxwell pinga Turni-di-Palco
    const maxwellToTurni = await makeRequest(`${SERVICES.turni}/health`);
    lastPing.turni = maxwellToTurni;
    
    // Turni-di-Palco pinga Maxwell (simulato)
    const turniToMaxwell = await makeRequest(`${SERVICES.maxwell}/health`);
    lastPing.maxwell = turniToMaxwell;
    
    // Log risultati
    log(`✅ Maxwell → Turni: ${maxwellToTurni.success ? '✓' : '✗'} (${maxwellToTurni.status}) ${maxwellToTurni.duration}ms`);
    if (!maxwellToTurni.success) {
      log(`   Errore: ${maxwellToTurni.error || 'Status ' + maxwellToTurni.status}`);
    }
    
    log(`✅ Turni → Maxwell: ${turniToMaxwell.success ? '✓' : '✗'} (${turniToMaxwell.status}) ${turniToMaxwell.duration}ms`);
    if (!turniToMaxwell.success) {
      log(`   Errore: ${turniToMaxwell.error || 'Status ' + turniToMaxwell.status}`);
    }
    
    // Health check responses
    if (maxwellToTurni.success && maxwellToTurni.data) {
      try {
        const health = JSON.parse(maxwellToTurni.data);
        log(`   Turni Health: ${health.status} (${health.service}) uptime: ${Math.floor(health.uptime)}s`);
      } catch (e) {
        log(`   Turni Response: ${maxwellToTurni.data.substring(0, 100)}...`);
      }
    }
    
    if (turniToMaxwell.success && turniToMaxwell.data) {
      try {
        const health = JSON.parse(turniToMaxwell.data);
        log(`   Maxwell Health: ${health.status}`);
      } catch (e) {
        log(`   Maxwell Response: ${turniToMaxwell.data.substring(0, 100)}...`);
      }
    }
    
    log('✨ Keep-alive completato');
    
  } catch (error) {
    log(`❌ Errore durante keep-alive: ${error.message}`);
  }
}

function getNextInterval() {
  // Aggiunge jitter per evitare che tutti i servizi pinghino nello stesso momento
  return INTERVAL_MS + Math.random() * JITTER_MS;
}

async function startKeepAlive() {
  log('🚀 Avvio Keep-Alive Reciproco per Render Free Tier');
  log(`📡 Servizi monitorati:`);
  log(`   Maxwell: ${SERVICES.maxwell}`);
  log(`   Turni: ${SERVICES.turni}`);
  log(`⏰ Intervallo: ${INTERVAL_MS/1000/60} minuti ± ${JITTER_MS/1000/60} min jitter`);
  
  // Prima esecuzione immediata
  await performKeepAlive();
  
  // Loop principale
  while (true) {
    const interval = getNextInterval();
    const nextRun = new Date(Date.now() + interval);
    log(`⏭️  Prossimo keep-alive: ${nextRun.toISOString()}`);
    
    await new Promise(resolve => setTimeout(resolve, interval));
    await performKeepAlive();
  }
}

// Gestione graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Ricevuto SIGINT, arresto in corso...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('🛑 Ricevuto SIGTERM, arresto in corso...');
  process.exit(0);
});

// Avvio
if (require.main === module) {
  startKeepAlive().catch(error => {
    log(`💥 Errore fatale: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { performKeepAlive, startKeepAlive };
