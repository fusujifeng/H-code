import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

function log(msg) { console.log(`[postinstall] ${msg}`) }
function warn(msg) { console.warn(`[postinstall] ${msg}`) }

// Resolve Electron version from the installed package
let electronVersion
try {
  const electronPkg = _require.resolve('electron/package.json')
  electronVersion = _require(electronPkg).version
  log(`Electron version: ${electronVersion}`)
} catch {
  warn('Electron not found, skipping native rebuild')
  process.exit(0)
}

const nativeModules = ['better-sqlite3', 'node-pty']

// Clean existing build artifacts so electron-rebuild won't skip them
for (const mod of nativeModules) {
  try {
    const modPath = dirname(_require.resolve(`${mod}/package.json`))
    const buildDir = resolve(modPath, 'build')
    if (existsSync(buildDir)) {
      log(`Cleaning ${mod} build artifacts...`)
      execSync(`rm -rf "${buildDir}"`, { stdio: 'pipe' })
    }
  } catch {
    // Module not installed, skip
  }
}

// Rebuild for Electron
try {
  log('Rebuilding native modules for Electron...')
  execSync('npx electron-builder install-app-deps', {
    stdio: 'inherit',
  })
  log('Native modules rebuilt successfully')
} catch (e) {
  warn(`electron-builder install-app-deps failed: ${e.message}`)

  // Fallback: rebuild better-sqlite3 manually with node-gyp
  try {
    log('Falling back to manual node-gyp rebuild for better-sqlite3...')
    const sqlite3Dir = dirname(_require.resolve('better-sqlite3/package.json'))
    execSync(
      `npx node-gyp rebuild --target=${electronVersion} --dist-url=https://electronjs.org/headers --arch=arm64`,
      { stdio: 'inherit', cwd: sqlite3Dir }
    )
    log('Manual rebuild succeeded')
  } catch (e2) {
    warn(`Manual rebuild also failed: ${e2.message}`)
    process.exit(1)
  }
}
