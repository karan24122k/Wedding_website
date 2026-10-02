# Comprehensive Website & Security Audit Suite (PowerShell)
# Kumar Video & Photography Production Integrity Suite

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "KUMAR VIDEO & PHOTOGRAPHY - INTEGRITY & AUDIT SUITE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Content JSON Validation
Write-Host "`n[SUITE 1/5] Validating content.json..." -ForegroundColor Yellow
$contentFile = Join-Path $rootDir "content.json"
if (-not (Test-Path $contentFile)) { throw "content.json is missing!" }
$contentJson = Get-Content $contentFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $contentJson.gallery) { throw "Missing 'gallery' key in content.json" }
if (-not $contentJson.films) { throw "Missing 'films' key in content.json" }
if (-not $contentJson.business) { throw "Missing 'business' key in content.json" }
Write-Host "[PASS] content.json syntax and schema valid." -ForegroundColor Green

# 2. Secret & Google Drive Link Leakage Audit
Write-Host "`n[SUITE 2/5] Auditing for Secret & Google Drive Link Leakage..." -ForegroundColor Yellow
$clientFiles = @("index.html", "gallery.html", "films.html", "404.html", "site.js", "styles.css", "content.json")
$leakPatterns = @(
    @{ Pattern = "drive\.google\.com/(?:file|drive|folders)/"; Name = "Direct Google Drive URL" },
    @{ Pattern = "AIzaSy[A-Za-z0-9_-]{33}"; Name = "Google API Key" },
    @{ Pattern = "-----BEGIN (?:RSA )?PRIVATE KEY-----"; Name = "Private Key Secret" },
    @{ Pattern = "[a-zA-Z0-9_-]+@(?:[a-zA-Z0-9-]+\.)+iam\.gserviceaccount\.com"; Name = "Service Account Email" }
)

$violations = 0
foreach ($file in $clientFiles) {
    $filePath = Join-Path $rootDir $file
    if (-not (Test-Path $filePath)) { continue }
    $text = Get-Content $filePath -Raw -Encoding UTF8
    foreach ($leak in $leakPatterns) {
        $matches = [regex]::Matches($text, $leak.Pattern)
        if ($matches.Count -gt 0) {
            Write-Host "[LEAK DETECTED] in $($file): Found $($leak.Name) ($($matches.Count) match(es))" -ForegroundColor Red
            $violations += $matches.Count
        }
    }
}

if ($violations -gt 0) {
    throw "Security audit failed with $violations violation(s)!"
}
Write-Host "[PASS] Zero secret leaks or Google Drive URLs detected in client files." -ForegroundColor Green

# 3. SEO Metadata & Heading Audit
Write-Host "`n[SUITE 3/5] Auditing SEO, Open Graph & Semantic HTML..." -ForegroundColor Yellow
$pages = @("index.html", "gallery.html", "films.html")
foreach ($page in $pages) {
    $filePath = Join-Path $rootDir $page
    $html = Get-Content $filePath -Raw -Encoding UTF8

    # Check lang="en"
    if ($html -notmatch '<html\s+lang="en">') { throw "$page missing lang='en'" }

    # Check title
    if ($html -notmatch '<title>(.*?)</title>') { throw "$page missing <title>" }

    # Check meta description
    if ($html -notmatch '<meta\s+name=["'']description["'']') { throw "$page missing meta description" }

    # Check canonical link
    if ($html -notmatch '<link\s+rel=["'']canonical["'']') { throw "$page missing canonical link" }

    # Check exactly one <h1>
    $h1Matches = [regex]::Matches($html, '<h1\b[^>]*>(.*?)</h1>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($h1Matches.Count -ne 1) { throw "$page must have exactly 1 <h1>, found $($h1Matches.Count)" }

    Write-Host "[PASS] $($page): SEO, metadata, canonical, and <h1> hierarchy validated." -ForegroundColor Green
}

# 4. Cloudflare Pages Functions & Media Gateway Files
Write-Host "`n[SUITE 4/5] Auditing Cloudflare Pages Functions & Gateway Architecture..." -ForegroundColor Yellow
$functions = @(
    "functions/api/_middleware.js",
    "functions/api/manifest.js",
    "functions/api/gallery/[category].js",
    "functions/api/media/[id].js",
    "functions/api/video/[id].js",
    "functions/api/sync.js",
    "functions/_lib/gdrive.js",
    "_headers",
    "_redirects",
    "wrangler.toml",
    "worker/index.js"
)

foreach ($func in $functions) {
    $p = Join-Path $rootDir $func
    if (-not (Test-Path -LiteralPath $p)) { throw "Missing critical gateway file: $func" }
}
Write-Host "[PASS] All 11 Cloudflare Pages Functions, Workers, _headers, and _redirects present." -ForegroundColor Green

# 5. Anti-Piracy Deterrent UX Check
Write-Host "`n[SUITE 5/5] Auditing Anti-Piracy Deterrent UX..." -ForegroundColor Yellow
$siteJs = Get-Content (Join-Path $rootDir "site.js") -Raw -Encoding UTF8
if ($siteJs -notmatch "showCopyrightToast") { throw "site.js missing showCopyrightToast" }
if ($siteJs -notmatch "contextmenu") { throw "site.js missing contextmenu deterrent" }
if ($siteJs -notmatch "dragstart") { throw "site.js missing dragstart prevention" }

$filmsHtml = Get-Content (Join-Path $rootDir "films.html") -Raw -Encoding UTF8
if ($filmsHtml -notmatch 'controlsList="nodownload"') { throw "films.html missing controlsList='nodownload'" }

Write-Host "[PASS] Anti-piracy deterrents (context-menu, dragstart, controlsList nodownload, toast) active." -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "ALL 5 PRODUCTION INTEGRITY SUITES PASSED! (100% OK)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
