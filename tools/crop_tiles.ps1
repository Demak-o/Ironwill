# Dev-only helper: crops tileset tiles at 4x zoom for inspection.
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('D:\Code\IW\Ironwill\Assets\Terrain\Tileset\Tilemap_color1.png')
$tile = 48
Write-Output "source $($src.Width)x$($src.Height) -> $($src.Width / $tile) x $($src.Height / $tile) tiles of ${tile}px"
$out = 'D:\Code\IW\Ironwill\tools\_inspect\tilemap1_zoom.png'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$bmp = New-Object System.Drawing.Bitmap(($src.Width * 3), ($src.Height * 3))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.DrawImage($src, 0, 0, $src.Width * 3, $src.Height * 3)
for ($x = 0; $x -le $src.Width; $x += $tile) {
    $g.DrawLine([System.Drawing.Pens]::Magenta, $x * 3, 0, $x * 3, $src.Height * 3)
}
for ($y = 0; $y -le $src.Height; $y += $tile) {
    $g.DrawLine([System.Drawing.Pens]::Magenta, 0, $y * 3, $src.Width * 3, $y * 3)
}
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
Write-Output "wrote $out"