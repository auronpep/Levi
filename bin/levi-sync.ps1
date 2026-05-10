#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Distribute Levi tool skills + hook configs to OpenClaw and Codex.

.DESCRIPTION
    Idempotent. Safe to re-run after editing any skills/tools/<name>/SKILL.md.
    Use -WhatIf for a dry run. Does NOT auto-merge ~/.codex/config.toml [hooks]
    section because of key-conflict risk; see codex/README.md for manual steps.

.EXAMPLE
    pwsh -NoProfile -File bin/levi-sync.ps1
    pwsh -NoProfile -File bin/levi-sync.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$LeviRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ToolsDir = Join-Path $LeviRoot 'skills\tools'

function Write-Section($name) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
}

function Sync-SkillsTo {
    param(
        [string]$Source,
        [string]$Target,
        [string]$Prefix = 'tool-'
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        return @{ Copied = 0; Skipped = 0 }
    }
    if ($PSCmdlet.ShouldProcess($Target, "Ensure directory")) {
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
    }
    $copied = 0
    $skipped = 0
    Get-ChildItem -LiteralPath $Source -Directory | ForEach-Object {
        $skill = Join-Path $_.FullName 'SKILL.md'
        if (-not (Test-Path -LiteralPath $skill)) { return }
        $destDir = Join-Path $Target ($Prefix + $_.Name)
        $destFile = Join-Path $destDir 'SKILL.md'
        if ((Test-Path -LiteralPath $destFile) -and
            ((Get-FileHash -LiteralPath $skill).Hash -eq (Get-FileHash -LiteralPath $destFile).Hash)) {
            $skipped++
            return
        }
        if ($PSCmdlet.ShouldProcess($destFile, "Copy SKILL.md")) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            Copy-Item -LiteralPath $skill -Destination $destFile -Force
        }
        $copied++
    }
    return @{ Copied = $copied; Skipped = $skipped }
}

function Sync-File {
    param([string]$Source, [string]$Target)
    if (-not (Test-Path -LiteralPath $Source)) { return $false }
    if ((Test-Path -LiteralPath $Target) -and
        ((Get-FileHash -LiteralPath $Source).Hash -eq (Get-FileHash -LiteralPath $Target).Hash)) {
        return $false
    }
    if ($PSCmdlet.ShouldProcess($Target, "Copy file")) {
        New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Target -Force
    }
    return $true
}

# 1. Validate
Write-Section "Validate"
Write-Host "Levi root:  $LeviRoot"
Write-Host "Tools dir:  $ToolsDir"
if (-not (Test-Path -LiteralPath $ToolsDir)) {
    Write-Host "skills/tools/ does not exist; nothing to sync." -ForegroundColor Yellow
    exit 0
}
$skillCount = (Get-ChildItem -LiteralPath $ToolsDir -Directory | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')
}).Count
Write-Host "Skill count: $skillCount"

# 2. OpenClaw
Write-Section "OpenClaw"
$ocPlugin = Join-Path $LeviRoot 'openclaw'
$ocPluginSkills = Join-Path $ocPlugin 'skills'
$ocResult = Sync-SkillsTo -Source $ToolsDir -Target $ocPluginSkills -Prefix 'tool-'
Write-Host ("Plugin skills mirrored at {0}: {1} copied, {2} unchanged" -f $ocPluginSkills, $ocResult.Copied, $ocResult.Skipped)

$ocUserSkillsDir = Join-Path $env:USERPROFILE '.openclaw\skills'
$ocUserResult = Sync-SkillsTo -Source $ToolsDir -Target $ocUserSkillsDir -Prefix 'tool-'
Write-Host ("User skills mirrored at {0}: {1} copied, {2} unchanged" -f $ocUserSkillsDir, $ocUserResult.Copied, $ocUserResult.Skipped)

if (Test-Path -LiteralPath $ocPlugin) {
    if (Get-Command openclaw -ErrorAction SilentlyContinue) {
        if ($PSCmdlet.ShouldProcess($ocPlugin, "openclaw plugins install")) {
            Write-Host "Installing/updating OpenClaw plugin pack..."
            # Use forward-slash path; openclaw mis-parses Windows backslashes as a URL scheme.
            # --force overwrites an existing installed pack so re-runs are idempotent.
            $ocPluginForwardSlash = $ocPlugin -replace '\\', '/'
            & openclaw plugins install --force $ocPluginForwardSlash
            if ($LASTEXITCODE -ne 0) {
                Write-Host "openclaw plugins install reported a non-zero exit code." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "openclaw CLI not found in PATH; skipping plugin install." -ForegroundColor Yellow
    }
}

# 3. Codex
Write-Section "Codex"
$codexDir = Join-Path $env:USERPROFILE '.codex'
$codexSkillsDir = Join-Path $codexDir 'skills'
$cxResult = Sync-SkillsTo -Source $ToolsDir -Target $codexSkillsDir -Prefix 'tool-'
Write-Host ("Skills mirrored at {0}: {1} copied, {2} unchanged" -f $codexSkillsDir, $cxResult.Copied, $cxResult.Skipped)

$codexRuntimeSrc = Join-Path $LeviRoot 'codex\runtime\tool-context-loader.js'
$codexRuntimeDest = Join-Path $codexDir 'runtime\levi\tool-context-loader.js'
if (Sync-File -Source $codexRuntimeSrc -Target $codexRuntimeDest) {
    Write-Host "Copied runtime handler to $codexRuntimeDest"
} else {
    Write-Host "Runtime handler at $codexRuntimeDest already current."
}

Write-Host ""
Write-Host "Codex [hooks] integration is manual. See $LeviRoot\codex\README.md." -ForegroundColor Yellow

Write-Section "Done"
Write-Host "Sync complete."
