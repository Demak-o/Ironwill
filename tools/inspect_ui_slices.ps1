# Ironwill - measure the 3x3 nine-slice atlas geometry of the UI textures.
#
# Every UI plate texture in this pack is a *pre-sliced* 3x3 atlas: a grid of nine
# cells separated by fully transparent gutters. UI.plate() must therefore slice at
# the atlas cell boundary, not at an arbitrary "corner" value, or it will cut
# through cells and render a broken box.
#
# This script prints, for each texture, the fully-transparent column/row bands so
# the real cell size can be read off directly.

Add-Type -AssemblyName System.Drawing

$files = @(
    'Assets\UI Elements\UI Elements\Papers\RegularPaper.png',
    'Assets\UI Elements\UI Elements\Papers\SpecialPaper.png',
    'Assets\UI Elements\UI Elements\Buttons\BigBlueButton_Regular.png',
    'Assets\UI Elements\UI Elements\Buttons\BigRedButton_Regular.png',
    'Assets\UI Elements\UI Elements\Wood Table\WoodTable.png',
    'Assets\UI Elements\UI Elements\Banners\Banner.png',
    'Assets\UI Elements\UI Elements\Bars\BigBar_Base.png',
    'Assets\UI Elements\UI Elements\Bars\SmallBar_Base.png'
)

foreach ($rel in $files) {
    $path = Join-Path (Get-Location) $rel
    if (-not (Test-Path $path)) { Write-Host "missing: $rel"; continue }
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $w = $bmp.Width; $h = $bmp.Height

    $colOpaque = New-Object 'int[]' $w
    $rowOpaque = New-Object 'int[]' $h
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            if ($bmp.GetPixel($x, $y).A -gt 8) { $colOpaque[$x]++; $rowOpaque[$y]++ }
        }
    }
    $bmp.Dispose()

    function Bands($arr, $len) {
        $out = @(); $start = -1
        for ($i = 0; $i -lt $len; $i++) {
            if ($arr[$i] -eq 0) { if ($start -lt 0) { $start = $i } }
            elseif ($start -ge 0) { $out += "$start-$($i-1)"; $start = -1 }
        }
        if ($start -ge 0) { $out += "$start-$($len-1)" }
        return ($out -join ', ')
    }

    Write-Host ("{0}  {1}x{2}" -f (Split-Path $rel -Leaf), $w, $h)
    Write-Host ("  empty columns: " + (Bands $colOpaque $w))
    Write-Host ("  empty rows   : " + (Bands $rowOpaque $h))
}