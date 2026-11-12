import assert from 'node:assert/strict';
import {git, repositoryRoot} from './release-version.mjs';

const versionTag = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export function generateUpdateNotes({source, root = repositoryRoot}) {
  assert.match(source, /^[a-f0-9]{40}$/i);
  const previous = git(['tag', '--merged', source, '--sort=-version:refname'], root).split('\n').find(tag => versionTag.test(tag));
  const changes = git(['log', '--no-merges', '--format=%s', previous ? `${previous}..${source}` : source], root).split('\n')
    .filter(subject => subject.trim() && !/^chore\(release\):/i.test(subject))
    .map(subject => '• ' + subject.replace(/^(?:feat|fix|style|perf|refactor|docs|test|build|ci|chore)(?:\([^)]*\))?!?:\s*/i, ''));
  return changes.join('\n') || '本次发布没有新的源码提交。';
}

export function generateReleaseNotes({version, source, repository, root = repositoryRoot}) {
  assert.match(source, /^[a-f0-9]{40}$/i, 'A full source commit is required for release notes');
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/, 'A GitHub repository is required for release notes');
  const tag = `v${version}`;
  const previousTag = git(['tag', '--merged', source, '--sort=-version:refname'], root)
    .split('\n')
    .find(candidate => versionTag.test(candidate));
  const range = previousTag ? `${previousTag}..${source}` : source;
  const changes = git(['log', '--no-merges', '--format=%H%x09%s', range], root)
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [commit, ...parts] = line.split('\t');
      const subject = parts.join('\t').trim();
      return {commit, subject};
    })
    .filter(({subject}) => subject && !/^chore\(release\):/i.test(subject));
  const history = changes.length
    ? changes.map(({commit, subject: originalSubject}) => {
      const subject = originalSubject.replace(/^(?:feat|fix|style|perf|refactor|docs|test|build|ci|chore)(?:\([^)]*\))?!?:\s*/i, '');
      return `- [${subject.replace(/[\\\[\]]/g, '\\$&')}](${`https://github.com/${repository}/commit/${commit}`})`;
    })
    : ['- 本次发布没有新的源码提交。'];
  const comparison = previousTag
    ? `https://github.com/${repository}/compare/${previousTag}...${source}`
    : `https://github.com/${repository}/commit/${source}`;

  return [
    '### 更新内容',
    ...history,
    '',
    `[查看完整变更](${comparison})`,
    '',
    '### 下载',
    'Windows x64 安装版与便携版 · macOS Intel / Apple Silicon 通用版 · Web 静态部署包。附件包含 SHA256 校验和及构建报告。',
    '',
    `源码：[${source.slice(0, 7)}](${`https://github.com/${repository}/commit/${source}`})。应用代码采用 MIT 许可；BodyParts3D 与 HRA 女性解剖数据采用 CC BY 4.0。女性选项为实验性衍生学习模型。`,
    '更新包提供签名校验，Windows 无系统代码签名；macOS 用户建议自行从源码构建，自动生成的 DMG 未经过 Apple 公证。',
    '',
  ].join('\n');
}
