// ZSnip 打包脚本 - 将插件打包成可发布的 zip 文件
// 使用 ES module 语法

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const __dirname = resolve()
const distDir = resolve(__dirname, 'dist')
const publicDir = resolve(__dirname, 'public')
const packageDir = resolve(__dirname, 'package-output')

console.log('[ZSnip] 开始打包...')

// 1. 执行 vite build
console.log('[ZSnip] 执行 vite build...')
try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
} catch (err) {
    console.error('[ZSnip] 构建失败:', err)
    process.exit(1)
}

// 2. 确保 dist 目录存在
if (!existsSync(distDir)) {
    console.error('[ZSnip] dist 目录不存在，构建可能失败')
    process.exit(1)
}

// 3. 复制 public 目录下的资源到 dist
console.log('[ZSnip] 复制 public 资源到 dist...')
const publicFiles = readdirSync(publicDir)
for (const file of publicFiles) {
    const srcPath = resolve(publicDir, file)
    const destPath = resolve(distDir, file)
    if (statSync(srcPath).isDirectory()) {
        cpSync(srcPath, destPath, { recursive: true })
    } else {
        cpSync(srcPath, destPath)
    }
}

// 4. 创建 package-output 目录
if (existsSync(packageDir)) {
    rmSync(packageDir, { recursive: true })
}
mkdirSync(packageDir, { recursive: true })

// 5. 打包成 zip（使用系统命令）
console.log('[ZSnip] 创建 zip 包...')
const zipPath = resolve(packageDir, 'zsnip.zip')

try {
    if (process.platform === 'win32') {
        // Windows: 使用 PowerShell Compress-Archive
        execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' })
    } else {
        // Unix: 使用 zip 命令
        execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' })
    }
    console.log(`[ZSnip] 打包完成: ${zipPath}`)
} catch (err) {
    console.error('[ZSnip] 打包失败:', err)
    console.log('[ZSnip] 提示: 请手动将 dist 目录打包成 zip')
}

console.log('[ZSnip] 打包流程结束')
console.log(`[ZSnip] 输出目录: ${packageDir}`)