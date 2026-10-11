# إنشاء اختصار سطح المكتب لتطبيق نظام إدارة العيادة
$ErrorActionPreference = 'Stop'
$release = 'C:\Users\DELL\Desktop\dashbord-doctor\release'
$exe = Get-ChildItem "$release\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'ClinicManager.lnk'

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $exe.FullName
$lnk.WorkingDirectory = $release
$lnk.Description = 'نظام إدارة العيادة — يعمل بلا إنترنت'
$lnk.Save()

Write-Output "OK: $lnkPath -> $($exe.FullName)"
