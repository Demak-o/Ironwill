# Dev-only helper: alpha bounding box of the first frame of each unit sheet.
# Used to derive per-type sprite scale + feet offset so all units stand on the same ground line.
Add-Type -AssemblyName System.Drawing

$root = 'D:\Code\IW\Ironwill\Assets\Units\Blue Units'
$files = @{
    Warrior = 'Warrior\Warrior_Idle.png'
    Archer  = 'Archer\Archer_Idle.png'
    Lancer  = 'Lancer\Lancer_Idle.png'
    Monk    = 'Monk\Idle.png'
    Pawn    = 'Pawn\Pawn_Idle.png'
}

foreach ($kv in $files.GetEnumerator()) {
    $path = Join-Path $root $kv.Value
    $img = New-Object System.Drawing.Bitmap($path)
    $fh = $img.Height
    $fw = $fh   # first frame is square
    $minX = $fw; $minY = $fh; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $fh; $y++) {
        for ($x = 0; $x -lt $fw; $x++) {
            $a = $img.GetPixel($x, $y).A
            if ($a -gt 24) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    $bodyW = $maxX - $minX + 1
    $bodyH = $maxY - $minY + 1
    $feetFrac = ($maxY - $fh / 2) / $fh
    $cxFrac = (($minX + $maxX) / 2 - $fw / 2) / $fh
    Write-Output ("{0,-8} frame={1} bbox=({2},{3})-({4},{5}) body={6}x{7} feetFrac={8:N3} cxFrac={9:N3}" -f `
        $kv.Key, $fh, $minX, $minY, $maxX, $maxY, $bodyW, $bodyH, $feetFrac, $cxFrac)
    $img.Dispose()
}

# Also measure the Lancer's side-facing run frame (different pose)
$img = New-Object System.Drawing.Bitmap((Join-Path $root 'Lancer\Lancer_Run.png'))
$fh = $img.Height
$minY = $fh; $maxY = -1; $minX = $fh; $maxX = -1
for ($y = 0; $y -lt $fh; $y++) {
    for ($x = 0; $x -lt $fh; $x++) {
        if ($img.GetPixel($x, $y).A -gt 24) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Output ("LancerRun frame={0} bbox=({1},{2})-({3},{4}) body={5}x{6} feetFrac={7:N3}" -f $fh, $minX, $minY, $maxX, $maxY, ($maxX - $minX + 1), ($maxY - $minY + 1), (($maxY - $fh / 2) / $fh))
$img.Dispose()