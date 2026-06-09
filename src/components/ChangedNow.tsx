import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { joinClass } from "../lib/classNames";
import { fileKind, formatPath, statusLetter } from "../lib/fileStatus";
import type { ChangedFile, FileFilter, PromptLanguage } from "../types";

export function changedFileKey(file: ChangedFile) {
  return `${file.status}-${file.path}-${file.originalPath ?? ""}`;
}

function deltaContent(file: ChangedFile) {
  if (!file.additions && !file.deletions) return <span>0</span>;

  return (
    <>
      {file.additions ? <span className="additions">+{file.additions}</span> : null}
      {file.deletions ? <span className="deletions">-{file.deletions}</span> : null}
    </>
  );
}

function filePromptLine(file: ChangedFile) {
  const delta = [file.additions ? `+${file.additions}` : "", file.deletions ? `-${file.deletions}` : ""].filter(Boolean).join(" ");
  const originalPath = file.originalPath ? ` from ${file.originalPath}` : "";
  const deltaText = delta ? ` (${delta})` : "";
  return `- [${statusLetter(file)}] ${file.path}${originalPath}: ${file.statusLabel}${deltaText}`;
}

function commitPrompt(files: ChangedFile[], filter: FileFilter, language: PromptLanguage) {
  const fileLines = files.length ? files.map(filePromptLine).join("\n") : "- No files in the current Changed Now filter.";

  if (language === "zh") {
    return `请检查当前仓库的 working tree，并判断是否适合现在 commit。

要求：
1. 先运行或阅读必要的 git status / git diff；下面的文件列表只作为线索。
2. 简洁说明变动意图、主要文件、风险或未完成点，以及是否 ready。
3. 只给出一个可执行 commit 方案：你自己决定是单个 commit，还是一组按顺序执行的分段 commits；如需分段，列出每段包含的文件和 commit message。不要给备选方案，也不要让用户选择文件、策略或 message。
4. 生成 commit message 前，先检查仓库是否有明确记录的 commit message 规则；有就遵守仓库规则，否则使用 Conventional Commits。
5. 最后只问一个 Yes/No 确认问题：用户回答 Yes 就按方案执行 commit，回答 No 就停止；在 Yes 前不要执行 git commit，也不要再追问其他决策。

Changed Now 当前列表（filter: ${filter}, files: ${files.length}）：
${fileLines}`;
  }

  return `Please inspect the current repository working tree and decide whether it is ready to commit.

Requirements:
1. Run or review the necessary git status / git diff; treat the file list below only as a clue.
2. Briefly summarize the change intent, key files, risks or unfinished work, and whether it is ready.
3. Provide exactly one executable commit plan: decide yourself whether it should be one commit or one ordered sequence of split commits; if split commits are needed, list the files and commit message for each. Do not give alternatives or ask the user to choose files, strategy, or messages.
4. Before drafting commit messages, check whether the repository documents its own commit-message rules; follow those if present, otherwise use Conventional Commits.
5. End with exactly one Yes/No confirmation question: if the user answers Yes, run the plan; if No, stop. Do not run git commit before Yes, and do not ask for any other decisions.

Current Changed Now list (filter: ${filter}, files: ${files.length}):
${fileLines}`;
}

export function ChangedFileInfoPanel({ file, onClose }: { file: ChangedFile; onClose: () => void }) {
  return (
    <aside className="changed-side-panel" aria-label="Changed file details">
      <header className="changed-side-header">
        <span className={joinClass("file-badge", fileKind(file))}>{statusLetter(file)}</span>
        <div>
          <h2 title={file.path}>{formatPath(file.path)}</h2>
          <span>{file.statusLabel}</span>
        </div>
        <button className="ui-icon-button" type="button" aria-label="Close changed file details" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <dl className="changed-side-facts">
        <div>
          <dt>Kind</dt>
          <dd>{fileKind(file)}</dd>
        </div>
        <div>
          <dt>Git</dt>
          <dd>{file.status.trim() || "?"}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd className="changed-side-delta">{deltaContent(file)}</dd>
        </div>
        <div className="is-wide">
          <dt>Path</dt>
          <dd title={file.path}>{file.path}</dd>
        </div>
        {file.originalPath ? (
          <div className="is-wide">
            <dt>From</dt>
            <dd title={file.originalPath}>{file.originalPath}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export function ChangedNow({
  files,
  filter,
  promptLanguage = "en",
  selectedFileKey,
  onClose,
  onSelectFile,
}: {
  files: ChangedFile[];
  filter: FileFilter;
  promptLanguage?: PromptLanguage;
  selectedFileKey: string;
  onClose?: () => void;
  onSelectFile: (fileKey: string) => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const filteredFiles = filter === "all" ? files : files.filter((file) => fileKind(file) === filter);

  async function copyCommitPrompt() {
    const prompt = commitPrompt(filteredFiles, filter, promptLanguage);

    try {
      if (window.gitPeek?.copyText) {
        await window.gitPeek.copyText(prompt);
      } else {
        await navigator.clipboard.writeText(prompt);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch (error) {
      console.warn("[Git Peek] Unable to copy prompt.", error);
    }
  }

  return (
    <section className="changed-section" aria-label="Changed now">
      <div className="section-heading compact">
        <h2>Changed now</h2>
        <div className="heading-tools">
          <span>{filteredFiles.length}</span>
          <button
            type="button"
            aria-label={copyState === "copied" ? "Copied prompt" : "Copy prompt to commit changes"}
            data-tooltip={copyState === "copied" ? "Copied prompt" : "Copy prompt to commit changes"}
            title={copyState === "copied" ? "Copied" : "Copy prompt to commit changes"}
            onClick={copyCommitPrompt}
          >
            {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button>
          {onClose ? (
            <button type="button" aria-label="Close changed files window" data-tooltip="Close window" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="file-list" id="changed-now-file-list">
        {filteredFiles.length ? (
          filteredFiles.slice(0, 8).map((file) => {
            const fileKey = changedFileKey(file);

            return (
              <button
                className={joinClass("file-row", selectedFileKey === fileKey && "is-selected")}
                type="button"
                key={fileKey}
                onClick={() => onSelectFile(fileKey)}
                aria-pressed={selectedFileKey === fileKey}
                title={file.path}
              >
                <span className={joinClass("file-badge", fileKind(file))}>{statusLetter(file)}</span>
                <span className="file-copy">
                  <span className="file-path" title={file.path}>
                    {formatPath(file.path)}
                  </span>
                  <span className="file-detail">
                    {file.statusLabel}
                    {file.originalPath ? ` from ${formatPath(file.originalPath)}` : ""}
                  </span>
                </span>
                <span className="file-delta">
                  {file.additions ? <span className="additions">+{file.additions}</span> : null}
                  {file.deletions ? <span className="deletions">-{file.deletions}</span> : null}
                </span>
              </button>
            );
          })
        ) : (
          <div className="empty-state">No files in this view.</div>
        )}
      </div>
    </section>
  );
}
