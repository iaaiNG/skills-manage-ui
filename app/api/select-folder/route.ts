import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import os from "node:os";

export const runtime = "nodejs";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    const platform = os.platform();

    if (platform === "darwin") {
      // macOS Native Folder Chooser via AppleScript
      exec(`osascript -e 'POSIX path of (choose folder with prompt "请选择 Skill 源仓储文件夹:")'`, (error, stdout) => {
        if (error || !stdout.trim()) {
          return resolve(NextResponse.json({ canceled: true }));
        }
        const selectedPath = stdout.trim().replace(/\/$/, "");
        return resolve(NextResponse.json({ success: true, folderPath: selectedPath }));
      });
    } else if (platform === "win32") {
      // Windows Native Folder Chooser via PowerShell
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "请选择 Skill 源仓储文件夹"
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.SelectedPath
        }
      `;
      exec(`powershell -Command "${psScript.replace(/\n/g, " ")}"`, (error, stdout) => {
        if (error || !stdout.trim()) {
          return resolve(NextResponse.json({ canceled: true }));
        }
        return resolve(NextResponse.json({ success: true, folderPath: stdout.trim() }));
      });
    } else {
      // Linux Native Folder Chooser via Zenity / Kdialog
      exec(`zenity --file-selection --directory --title="请选择 Skill 源仓储文件夹"`, (error, stdout) => {
        if (error || !stdout.trim()) {
          return resolve(NextResponse.json({ canceled: true }));
        }
        return resolve(NextResponse.json({ success: true, folderPath: stdout.trim() }));
      });
    }
  });
}
