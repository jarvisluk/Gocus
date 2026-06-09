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
    return `请查看当前仓库的 working tree，解释目前这些变动是什么，并帮我判断是否适合现在 commit。

要求：
1. 先运行或阅读必要的 git status / git diff，不要只依赖下面的文件列表。
2. 用简洁中文概括变动意图、主要文件、风险和是否还有未完成点。
3. 你必须自己做取舍，最后只给出一个可执行方案：要么一个 commit，要么一组按顺序执行的分段 commits。不要列多个备选方案，不要让用户选择文件、策略或 commit message。
4. 如果变动范围太大或混合了多个主题，你要自己决定最合理的分段 commit 顺序，并给出每一段会包含的文件和 commit message；这仍然只能是一个推荐方案。
5. 最后只问一个 Yes/No 确认问题：用户回答 Yes 就按这个方案执行 commit，回答 No 就停止。不要再追问用户做其他决策。
6. 在用户明确回答 Yes 前不要执行 git commit。

Changed Now 当前列表（filter: ${filter}, files: ${files.length}）：
${fileLines}`;
  }

  return `Please inspect the current repository working tree, explain what the current changes are, and help decide whether they are ready to commit.

Requirements:
1. Run or review the necessary git status / git diff; do not rely only on the file list below.
2. Concisely summarize the change intent, key files, risks, and any unfinished work.
3. You must make the tradeoff yourself and finish with exactly one executable plan: either one commit or one ordered sequence of split commits. Do not list alternative plans, and do not ask the user to choose files, strategy, or commit messages.
4. If the changes are too broad or span multiple themes, decide the safest split-commit sequence yourself and state the files plus commit message for each commit; this still counts as one recommended plan.
5. End with exactly one Yes/No confirmation question: if the user answers Yes, run the commit plan as stated; if the user answers No, stop. Do not ask the user for any further decisions.
6. Do not run git commit until the user explicitly answers Yes.

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
