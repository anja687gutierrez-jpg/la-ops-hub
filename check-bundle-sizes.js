#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STAP Bundle Size Checker - "Check Engine Light" for Code Health
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Warns when any file exceeds size thresholds that cause Babel deoptimization
 * or browser performance issues.
 *
 * Usage:
 *   node check-bundle-sizes.js              # Check all files
 *   node check-bundle-sizes.js --ci         # Exit with error code if thresholds exceeded
 *   node check-bundle-sizes.js --json       # Output JSON report
 *
 * Thresholds:
 *   - CRITICAL (500KB): Babel Standalone deoptimization threshold
 *   - WARNING (350KB):  Plan refactor before it becomes critical
 *   - INFO (200KB):     Large file, consider splitting
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Size thresholds in bytes
    thresholds: {
        critical: 500 * 1024,  // 500KB - Babel deoptimization
        warning: 350 * 1024,   // 350KB - Plan refactor
        info: 200 * 1024       // 200KB - Consider splitting
    },

    // Files to check (relative to project root)
    files: [
        'index.html',
        'demo.html',
        'demo.js',
        'impressionsDashboard.js',
        'detailModal.js',
        'digestModal.js',
        'canvasGearSidebar.js',
        'riskCommandCenter.js'
    ],

    // Patterns to auto-discover
    patterns: [
        '*.html',
        '*.js'
    ],

    // Files to ignore
    ignore: [
        'node_modules',
        'check-bundle-sizes.js',
        'test-*.js',
        '*.min.js'
    ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const getLevel = (size) => {
    if (size >= CONFIG.thresholds.critical) return 'CRITICAL';
    if (size >= CONFIG.thresholds.warning) return 'WARNING';
    if (size >= CONFIG.thresholds.info) return 'INFO';
    return 'OK';
};

const getLevelColor = (level) => {
    const colors = {
        CRITICAL: '\x1b[31m', // Red
        WARNING: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',     // Cyan
        OK: '\x1b[32m'        // Green
    };
    return colors[level] || '';
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHECKER
// ═══════════════════════════════════════════════════════════════════════════════

function checkBundleSizes(options = {}) {
    const projectRoot = path.dirname(__filename);
    const results = [];
    let hasCritical = false;
    let hasWarning = false;

    console.log('\n' + BOLD + '═══════════════════════════════════════════════════════════════' + RESET);
    console.log(BOLD + '  📦 STAP Bundle Size Checker' + RESET);
    console.log(BOLD + '═══════════════════════════════════════════════════════════════' + RESET + '\n');

    // Collect files to check
    const filesToCheck = new Set();

    // Add explicit files
    CONFIG.files.forEach(f => {
        const fullPath = path.join(projectRoot, f);
        if (fs.existsSync(fullPath)) {
            filesToCheck.add(f);
        }
    });

    // Auto-discover by pattern
    try {
        const entries = fs.readdirSync(projectRoot);
        entries.forEach(entry => {
            // Skip ignored
            if (CONFIG.ignore.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                    return regex.test(entry);
                }
                return entry === pattern || entry.startsWith(pattern);
            })) {
                return;
            }

            // Check patterns
            CONFIG.patterns.forEach(pattern => {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                if (regex.test(entry)) {
                    const stat = fs.statSync(path.join(projectRoot, entry));
                    if (stat.isFile()) {
                        filesToCheck.add(entry);
                    }
                }
            });
        });
    } catch (e) {
        console.error('Error scanning directory:', e.message);
    }

    // Check each file
    const sortedFiles = Array.from(filesToCheck).sort();

    sortedFiles.forEach(file => {
        try {
            const fullPath = path.join(projectRoot, file);
            const stats = fs.statSync(fullPath);
            const size = stats.size;
            const level = getLevel(size);
            const color = getLevelColor(level);

            if (level === 'CRITICAL') hasCritical = true;
            if (level === 'WARNING') hasWarning = true;

            const result = {
                file,
                size,
                sizeFormatted: formatBytes(size),
                level,
                thresholdExceeded: level !== 'OK' && level !== 'INFO'
            };
            results.push(result);

            // Console output
            const icon = {
                CRITICAL: '🔴',
                WARNING: '🟡',
                INFO: '🔵',
                OK: '🟢'
            }[level];

            const bar = '█'.repeat(Math.min(40, Math.floor(size / (CONFIG.thresholds.critical / 40))));
            const barColor = level === 'CRITICAL' ? '\x1b[31m' :
                            level === 'WARNING' ? '\x1b[33m' :
                            level === 'INFO' ? '\x1b[36m' : '\x1b[32m';

            console.log(`${icon} ${color}${BOLD}${level.padEnd(8)}${RESET} ${file.padEnd(30)} ${formatBytes(size).padStart(10)}`);
            console.log(`   ${barColor}${bar}${RESET}`);

            if (level === 'CRITICAL') {
                console.log(`   ${DIM}⚠️  Exceeds Babel 500KB limit - will cause deoptimization/hangs${RESET}`);
            } else if (level === 'WARNING') {
                console.log(`   ${DIM}⚠️  Approaching limit - plan refactor soon${RESET}`);
            }
            console.log('');

        } catch (e) {
            console.log(`❓ SKIP     ${file.padEnd(30)} (${e.message})`);
        }
    });

    // Summary
    console.log(BOLD + '═══════════════════════════════════════════════════════════════' + RESET);
    console.log(BOLD + '  Summary' + RESET);
    console.log(BOLD + '═══════════════════════════════════════════════════════════════' + RESET);

    const criticalCount = results.filter(r => r.level === 'CRITICAL').length;
    const warningCount = results.filter(r => r.level === 'WARNING').length;
    const totalSize = results.reduce((sum, r) => sum + r.size, 0);

    console.log(`\n  Total files checked: ${results.length}`);
    console.log(`  Total size: ${formatBytes(totalSize)}`);
    console.log('');

    if (criticalCount > 0) {
        console.log(`  ${getLevelColor('CRITICAL')}${BOLD}🔴 ${criticalCount} CRITICAL${RESET} - Immediate action required`);
    }
    if (warningCount > 0) {
        console.log(`  ${getLevelColor('WARNING')}${BOLD}🟡 ${warningCount} WARNING${RESET} - Plan refactor`);
    }
    if (criticalCount === 0 && warningCount === 0) {
        console.log(`  ${getLevelColor('OK')}${BOLD}✅ All files within healthy limits${RESET}`);
    }

    console.log('\n' + DIM + '  Thresholds:' + RESET);
    console.log(DIM + `    CRITICAL: ${formatBytes(CONFIG.thresholds.critical)} (Babel deoptimization)` + RESET);
    console.log(DIM + `    WARNING:  ${formatBytes(CONFIG.thresholds.warning)} (Plan refactor)` + RESET);
    console.log(DIM + `    INFO:     ${formatBytes(CONFIG.thresholds.info)} (Consider splitting)` + RESET);
    console.log('');

    // Recommendations for critical files
    if (hasCritical) {
        console.log(BOLD + '═══════════════════════════════════════════════════════════════' + RESET);
        console.log(BOLD + '  🔧 Recommended Actions' + RESET);
        console.log(BOLD + '═══════════════════════════════════════════════════════════════' + RESET);
        console.log(`
  For files exceeding 500KB (Babel limit):

  1. EXTRACT COMPONENTS to separate .js files:
     - Use React.createElement() syntax (no JSX)
     - Export via window.STAPComponentName = { ... }
     - Load with <script src="component.js"></script>

  2. LAZY LOAD large features:
     - Use STAPModuleLoader.loadScript() for on-demand loading
     - Show loading placeholder until ready

  3. SPLIT DATA from code:
     - Move large data objects (ZIP codes, mappings) to JSON
     - Fetch async on demand

  Example extraction pattern:
  ┌─────────────────────────────────────────────────────────────┐
  │ // myComponent.js                                           │
  │ (function(window) {                                         │
  │     const MyComponent = function(props) {                   │
  │         return React.createElement('div', null, 'Hello');   │
  │     };                                                      │
  │     window.STAPMyComponent = { MyComponent };               │
  │ })(window);                                                 │
  └─────────────────────────────────────────────────────────────┘
`);
    }

    // JSON output
    if (options.json) {
        console.log('\n' + JSON.stringify({
            timestamp: new Date().toISOString(),
            results,
            summary: {
                totalFiles: results.length,
                totalSize,
                criticalCount,
                warningCount
            },
            thresholds: CONFIG.thresholds
        }, null, 2));
    }

    // CI mode - exit with error if critical/warning
    if (options.ci && (hasCritical || hasWarning)) {
        console.log('\n' + getLevelColor('CRITICAL') + BOLD + '❌ CI Check Failed - Bundle size thresholds exceeded' + RESET + '\n');
        process.exit(1);
    }

    return { results, hasCritical, hasWarning };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const options = {
    ci: args.includes('--ci'),
    json: args.includes('--json')
};

checkBundleSizes(options);
