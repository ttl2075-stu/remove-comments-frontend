const vscode = require("vscode");
const path = require("path");
const { removeComments } = require("./removeComments.js");

const SUPPORTED_EXTENSIONS = new Set([".js", ".ts", ".jsx", ".tsx", ".css"]);

function getTypeFromDocument(document) {
  const lang = document.languageId;
  if (lang === "typescript") return "ts";
  if (lang === "javascriptreact") return "jsx";
  if (lang === "typescriptreact") return "tsx";
  if (lang === "css") return "css";
  return "js";
}

function getTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".tsx") return "tsx";
  if (ext === ".css") return "css";
  return "js";
}

async function removeCommentsFromDocument(document) {
  const code = document.getText();
  const type = getTypeFromDocument(document);
  const newCode = await removeComments(code, type);

  const edit = new vscode.WorkspaceEdit();
  const firstLine = document.lineAt(0);
  const lastLine = document.lineAt(document.lineCount - 1);
  const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

  edit.replace(document.uri, fullRange, newCode);
  await vscode.workspace.applyEdit(edit);
}

function activate(context) {
  let fileDisposable = vscode.commands.registerCommand(
    "extension.removeComments",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      const code = document.getText();

      if (code.length > 50000) {
        vscode.window.showWarningMessage(
          "File is large, removing comments may take a few seconds..."
        );
      }

      try {
        await removeCommentsFromDocument(document);
        vscode.window.showInformationMessage(
          "Comments removed successfully! ✨"
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          "Error removing comments: " + err.message
        );
      }
    }
  );

  let folderDisposable = vscode.commands.registerCommand(
    "extension.removeCommentsFolder",
    async () => {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select folder to remove comments",
        defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
      });

      if (!selected || selected.length === 0) return;
      const folderUri = selected[0];

      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folderUri, "**/*.{js,ts,jsx,tsx,css}"),
        new vscode.RelativePattern(
          folderUri,
          "**/{node_modules,dist,.git,out,.next,.nuxt,build}/**"
        )
      );

      if (files.length === 0) {
        vscode.window.showInformationMessage(
          "No supported files found in selected folder."
        );
        return;
      }

      let updatedCount = 0;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Removing comments in folder...",
          cancellable: false,
        },
        async (progress) => {
          for (let index = 0; index < files.length; index++) {
            const fileUri = files[index];
            const ext = path.extname(fileUri.fsPath).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

            const document = await vscode.workspace.openTextDocument(fileUri);
            const code = document.getText();
            const type = getTypeFromPath(document.uri.fsPath);
            const newCode = await removeComments(code, type);
            if (newCode === code) continue;

            const edit = new vscode.WorkspaceEdit();
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(
              firstLine.range.start,
              lastLine.range.end
            );
            edit.replace(document.uri, fullRange, newCode);
            await vscode.workspace.applyEdit(edit);
            await document.save();
            updatedCount++;

            progress.report({
              increment: 100 / files.length,
              message: `${index + 1}/${files.length}`,
            });
          }
        }
      );

      vscode.window.showInformationMessage(
        `Done. Removed comments in ${updatedCount} file(s).`
      );
    }
  );

  context.subscriptions.push(fileDisposable, folderDisposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
