/**
 * ══════════════════════════════════════════════════════════════════════
 * PREMA VASAM • PM2 Process Manager Configuration (For GoDaddy VPS)
 * ══════════════════════════════════════════════════════════════════════
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'premavasam',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
