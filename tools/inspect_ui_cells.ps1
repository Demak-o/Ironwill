# Ironwill - find the nine atlas cells inside each UI plate texture.
#
# Prints the bounding box of every non-transparent connected region, which tells
# us exactly which source rects UI.plate() should map to the 3x3 nine-slice grid.

Add-Type -AssemblyName System.Drawing

$files = @(
    'Assets\UI Elements\UI Elements\Papers\RegularPaper.png',
    'Assets\UI Elements\UI Elements\Papers\SpecialPaper.png',
    'Assets\UI Elements\UI Elements\Buttons\BigBlueButton_Regular.png',
    'Assets\UI Elements\UI Elements\Wood Table\WoodTable.png',
    'Assets\UI Elements\UI Elements\Banners\Banner.png',
    'Assets\UI Elements\UI Elements\Bars\BigBar_Base.png',
    'Assets\UI Elements\UI Elements\Bars\SmallBar_Base.png',
    'Assets\UI Elements\UI Elements\Bars\BigBar_Fill.png',
    'Assets\UI Elements\UI Elements\Buttons\SmallBlueSquareButton_Regular.png',
    'Assets\UI Elements\UI Elements\Buttons\TinySquareBlueButton.png',
    'Assets\UI Elements\UI Elements\Buttons\SmallBlueRoundButton_Regular.png',
    'Assets\UI Elements\UI Elements\Banners\Banner_Slots.png',
    'Assets\UI Elements\UI Elements\Wood Table\WoodTable_Slots.png',
    'Assets\UI Elements\UI Elements\Ribbons\SmallRibbons.png'
)

foreach ($rel in $files) {
    $path = Join-Path (Get-Location) $rel
    if (-not (Test-Path $path)) { Write-Host "missing: $rel"; continue }
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $w = $bmp.Width; $h = $bmp.Height
    $seen = New-Object 'bool[]' ($w * $h)
    $opaque = New-Object 'bool[]' ($w * $h)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $opaque[$y * $w + $x] = ($bmp.GetPixel($x, $y).A -gt 8)
        }
    }
    $bmp.Dispose()

    Write-Host ("=== {0}  {1}x{2}" -f (Split-Path $rel -Leaf), $w, $h)
    for ($y0 = 0; $y0 -lt $h; $y0++) {
        for ($x0 = 0; $x0 -lt $w; $x0++) {
            $i0 = $y0 * $w + $x0
            if (-not $opaque[$i0] -or $seen[$i0]) { continue }
            # flood fill (4-way, iterative)
            $stack = New-Object System.Collections.Stack
            $stack.Push($i0); $seen[$i0] = $true
            $minX = $x0; $maxX = $x0; $minY = $y0; $maxY = $y0; $count = 0
            while ($stack.Count -gt 0) {
                $i = $stack.Pop(); $cy = [int][Math]::Floor($i / $w); $cx = $i - $cy * $w
                $count++
                if ($cx -lt $minX) { $minX = $cx }; if ($cx -gt $maxX) { $maxX = $cx }
                if ($cy -lt $minY) { $minY = $cy }; if ($cy -gt $maxY) { $maxY = $cy }
                foreach ($d in @(@(1,0),@(-1,0),@(0,1),@(0,-1))) {
                    $nx = $cx + $d[0]; $ny = $cy + $d[1]
                    if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
                    $ni = $ny * $w + $nx
                    if ($opaque[$ni] -and -not $seen[$ni]) { $seen[$ni] = $true; $stack.Push($ni) }
                }
            }
            if ($count -gt 200) {
                Write-Host ("  cell x {0,4}..{1,4}  y {2,4}..{3,4}   ({4}x{5}, {6}px)" -f `
                    $minX, $maxX, $minY, $maxY, ($maxX - $minX + 1), ($maxY - $minY + 1), $count)
            }
        }
    }
}