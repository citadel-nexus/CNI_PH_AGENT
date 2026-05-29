param(
    [string]$RepoPath = ".",
    [switch]$PushAfterSync
)

Write-Host "`n=== PostHog Code Fork Sync ===" -ForegroundColor Cyan

Push-Location $RepoPath

# Ensure upstream exists
$remotes = git remote
if ($remotes -notcontains "upstream") {
    Write-Host "[setup] Adding upstream remote..." -ForegroundColor Yellow
    git remote add upstream https://github.com/PostHog/code.git
}

# Fetch upstream
Write-Host "[fetch] Pulling latest from PostHog/code..." -ForegroundColor Yellow
git fetch upstream

# Check current branch
$branch = git branch --show-current
if ($branch -ne "main") {
    Write-Host "[warn] You're on branch '$branch', switching to main" -ForegroundColor Red
    git checkout main
}

# Merge upstream
Write-Host "[merge] Merging upstream/main..." -ForegroundColor Yellow
$mergeResult = git merge upstream/main --no-edit 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "[conflict] Merge conflicts detected:" -ForegroundColor Red
    git diff --name-only --diff-filter=U
    Write-Host "`nResolve conflicts, then run:" -ForegroundColor Yellow
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit --no-edit" -ForegroundColor White
    Write-Host "  git push origin main" -ForegroundColor White
    Pop-Location
    return
}

Write-Host "[ok] Merge clean" -ForegroundColor Green

if ($PushAfterSync) {
    Write-Host "[push] Pushing to origin..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[done] Fork synced and pushed!" -ForegroundColor Green
    } else {
        Write-Host "[error] Push failed - check credentials" -ForegroundColor Red
    }
} else {
    Write-Host "[ready] Run 'git push origin main' when ready" -ForegroundColor Yellow
}

# Show status
$ahead = (git rev-list --count upstream/main..HEAD)
$behind = (git rev-list --count HEAD..upstream/main)
Write-Host "`nStatus: $ahead ahead, $behind behind upstream" -ForegroundColor Cyan

Pop-Location