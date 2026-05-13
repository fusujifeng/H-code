#!/usr/bin/env node
/**
 * ClaudeBridge 自动发布脚本
 *
 * 用法:
 *   node scripts/release.js           # 交互式选择版本升级类型
 *   node scripts/release.js patch     # 直接升级 patch 版本
 *   node scripts/release.js minor     # 直接升级 minor 版本
 *   node scripts/release.js major     # 直接升级 major 版本
 *   node scripts/release.js 1.2.3     # 直接指定版本号
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
const currentVersion = pkg.version

// ── 颜色输出 ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
}
function log(msg) { console.log(msg) }
function info(msg) { console.log(`${c.cyan}ℹ${c.reset} ${msg}`) }
function success(msg) { console.log(`${c.green}✓${c.reset} ${msg}`) }
function warn(msg) { console.log(`${c.yellow}⚠${c.reset} ${msg}`) }
function error(msg) { console.log(`${c.red}✗${c.reset} ${msg}`) }

// ── 版本号操作 ────────────────────────────────────────────
function bump(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function isValidVersion(v) {
  return /^\d+\.\d+\.\d+/.test(v)
}

// ── 执行 shell 命令 ───────────────────────────────────────
function run(cmd, opts = {}) {
  const silent = opts.silent ?? false
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      cwd: path.join(__dirname, '..'),
      ...opts,
    })
    return result?.trim()
  } catch (e) {
    if (opts.fatal !== false) {
      error(`命令执行失败: ${cmd}`)
      process.exit(1)
    }
    return null
  }
}

// ── 检查 git 状态 ─────────────────────────────────────────
function checkGitStatus() {
  const status = run('git status --porcelain', { silent: true })
  if (status) {
    warn('当前工作区有未提交的改动：')
    console.log(status)
    const answer = process.argv.includes('--force') ? 'y' : null
    if (!answer) {
      error('请先提交或 stash 改动，或使用 --force 跳过检查')
      process.exit(1)
    }
  }
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  log(`\n${c.bold}ClaudeBridge 自动发布脚本${c.reset}\n`)
  info(`当前版本: ${c.bold}${currentVersion}${c.reset}`)

  // 1. 解析版本参数
  let newVersion = ''
  const arg = process.argv[2]

  if (!arg || arg === '--force') {
    // 交互式选择
    const readline = require('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const ask = (q) => new Promise((resolve) => rl.question(q, resolve))

    log('')
    log(`  ${c.dim}[1]${c.reset} patch  (${currentVersion} → ${bump(currentVersion, 'patch')})`)
    log(`  ${c.dim}[2]${c.reset} minor  (${currentVersion} → ${bump(currentVersion, 'minor')})`)
    log(`  ${c.dim}[3]${c.reset} major  (${currentVersion} → ${bump(currentVersion, 'major')})`)
    log(`  ${c.dim}[4]${c.reset} 自定义版本号`)
    log('')

    const choice = await ask('请选择版本升级类型 (1-4): ')

    if (choice === '1') newVersion = bump(currentVersion, 'patch')
    else if (choice === '2') newVersion = bump(currentVersion, 'minor')
    else if (choice === '3') newVersion = bump(currentVersion, 'major')
    else if (choice === '4') {
      const custom = await ask('输入版本号 (如 1.2.3): ')
      newVersion = custom.trim()
    } else {
      error('无效选择')
      rl.close()
      process.exit(1)
    }
    rl.close()
  } else if (['patch', 'minor', 'major'].includes(arg)) {
    newVersion = bump(currentVersion, arg)
  } else if (isValidVersion(arg)) {
    newVersion = arg
  } else {
    error(`未知参数: ${arg}`)
    log('用法: node scripts/release.js [patch|minor|major|x.x.x]')
    process.exit(1)
  }

  if (!isValidVersion(newVersion)) {
    error(`版本号格式无效: ${newVersion}`)
    process.exit(1)
  }

  log(`\n${c.bold}目标版本: ${c.green}${newVersion}${c.reset}\n`)

  // 2. 检查 git 状态
  checkGitStatus()

  // 3. 更新 package.json
  info('更新 package.json 版本号...')
  pkg.version = newVersion
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  success(`package.json 已更新为 ${newVersion}`)

  // 4. Git 提交 + 打 tag
  info('创建 git commit 和 tag...')
  run(`git add package.json`)
  run(`git commit -m "chore(release): v${newVersion}"`)
  run(`git tag v${newVersion}`)
  success(`已创建 commit 和 tag v${newVersion}`)

  // 5. 推送
  const currentBranch = run('git branch --show-current', { silent: true }) || 'main'
  info('推送到远程仓库...')
  run(`git push origin ${currentBranch}`)
  run(`git push origin v${newVersion}`)
  success('推送完成')

  // 6. 提示
  log(`\n${c.bold}${c.green}🎉 发布流程已启动！${c.reset}\n`)
  log(`GitHub Actions 将自动构建并发布 v${newVersion}`)
  log(`监控地址: https://github.com/fusujifeng/H-code/actions`)
  log(`Release 页面: https://github.com/fusujifeng/H-code/releases`)
  log('')
  warn('如果你只想本地打包不上传，请运行: pnpm dist')
  log('')
}

main().catch((e) => {
  error(e.message)
  process.exit(1)
})
