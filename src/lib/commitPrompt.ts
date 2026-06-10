import type { ChangedFile, FileFilter, PromptLanguage } from "../types";
import { statusLetter } from "./fileStatus";

const zhCommitPromptRequirements = [
  "1. 先运行或阅读必要的 git status / git diff；下面的文件列表只作为线索。",
  "2. 简洁说明变动意图、主要文件、风险或未完成点，以及是否 ready。",
  "3. 只给出一个可执行 commit 方案：你自己决定是单个 commit，还是一组按顺序执行的分段 commits；" +
    "如需分段，列出每段包含的文件和 commit message。" +
    "不要给备选方案，也不要让用户选择文件、策略或 message。",
  "4. 生成 commit message 前，先检查仓库是否有明确记录的 commit message 规则；" +
    "有就遵守仓库规则，否则使用 Conventional Commits。",
  "5. 最后只问一个 Yes/No 确认问题：用户回答 Yes 就按方案执行 commit，回答 No 就停止；" +
    "在 Yes 前不要执行 git commit，也不要再追问其他决策。",
];

const enCommitPromptRequirements = [
  "1. Run or review the necessary git status / git diff; treat the file list below only as a clue.",
  "2. Briefly summarize the change intent, key files, risks or unfinished work, and whether it is ready.",
  "3. Provide exactly one executable commit plan: decide yourself whether it should be one commit " +
    "or one ordered sequence of split commits; if split commits are needed, list the files and commit message for each. " +
    "Do not give alternatives or ask the user to choose files, strategy, or messages.",
  "4. Before drafting commit messages, check whether the repository documents its own commit-message rules; " +
    "follow those if present, otherwise use Conventional Commits.",
  "5. End with exactly one Yes/No confirmation question: if the user answers Yes, run the plan; if No, stop. " +
    "Do not run git commit before Yes, and do not ask for any other decisions.",
];

export function changedFilePromptLine(file: ChangedFile) {
  const delta = [file.additions ? `+${file.additions}` : "", file.deletions ? `-${file.deletions}` : ""].filter(Boolean).join(" ");
  const originalPath = file.originalPath ? ` from ${file.originalPath}` : "";
  const deltaText = delta ? ` (${delta})` : "";
  return `- [${statusLetter(file)}] ${file.path}${originalPath}: ${file.statusLabel}${deltaText}`;
}

export function changedFilesCommitPrompt(files: ChangedFile[], filter: FileFilter, language: PromptLanguage) {
  const fileLines = files.length ? files.map(changedFilePromptLine).join("\n") : "- No files in the current Changed Now filter.";

  if (language === "zh") {
    return `请检查当前仓库的 working tree，并判断是否适合现在 commit。

要求：
${zhCommitPromptRequirements.join("\n")}

Changed Now 当前列表（filter: ${filter}, files: ${files.length}）：
${fileLines}`;
  }

  return `Please inspect the current repository working tree and decide whether it is ready to commit.

Requirements:
${enCommitPromptRequirements.join("\n")}

Current Changed Now list (filter: ${filter}, files: ${files.length}):
${fileLines}`;
}
