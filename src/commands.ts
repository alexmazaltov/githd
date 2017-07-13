'use strict'

import { Uri, commands, Disposable, workspace, window , scm} from 'vscode';
import { selectCommittedFilesView, setExplorerViewWithFolder } from './extension';
import { FileProvider } from './model';
import { HistoryViewProvider } from './historyViewProvider';
import { git } from './git';

function fromGitUri(uri: Uri): { path: string, ref: string; } {
    return JSON.parse(uri.query);
}

function toGitUri(uri: Uri, ref: string, replaceFileExtension = false): Uri {
    return uri.with({
        scheme: 'git',
        path: replaceFileExtension ? `${uri.path}.git` : uri.path,
        query: JSON.stringify({
            path: uri.fsPath,
            ref
        })
    });
}

interface Command {
    id: string;
    method: Function;
}

const Commands: Command[] = [];

function command(id: string) {
    return function (target: any, key: string, descriptor: PropertyDescriptor) {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        Commands.push({ id, method: descriptor.value });
    }
}

export class CommandCenter {
    private _disposables: Disposable[];

    set fileProvider(provider: FileProvider) { this._fileProvider = provider; }

    constructor(private _fileProvider: FileProvider, private _viewProvider: HistoryViewProvider) {
        this._disposables = Commands.map(({ id, method }) => {
            return commands.registerCommand(id, (...args: any[]) => {
                Promise.resolve(method.apply(this, args));
            });
        });
    }
    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    @command('githd.updateSha')
    async updateSha(): Promise<void> {
        await this._fileProvider.update(scm.inputBox.value);
    }

    @command('githd.clear')
    async clear(): Promise<void> {
        this._fileProvider.clear();
    }

    @command('githd.switch')
    async close(): Promise<void> {
        await commands.executeCommand<void>('scm.switch', ['Git']);
    }

    @command('githd.viewHistory')
    async viewHistory(): Promise<void> {
        this._viewProvider.update();
        workspace.openTextDocument(HistoryViewProvider.defaultUri).then(doc => {
            window.showTextDocument(doc);
            if (!this._viewProvider.loadingMore) {
                commands.executeCommand('cursorTop');
            }
        });
    }

    @command('githd.viewAllHistory')
    async viewAllHistory(): Promise<void> {
        this._viewProvider.update(true);
        workspace.openTextDocument(HistoryViewProvider.defaultUri).then(doc => {
            window.showTextDocument(doc);
            if (!this._viewProvider.loadingMore) {
                commands.executeCommand('cursorTop');
            }
        });
    }

    @command('githd.selectBranch')
    async selectBranch(): Promise<void> {
        const refs = await git.getRefs();
        const picks = refs.map(ref => {
            let description: string;
            if (ref.type === git.RefType.Head) {
                description = ref.commit;
            } else if (ref.type === git.RefType.Tag) {
                description = `Tag at ${ref.commit}`;
            } else if (ref.type === git.RefType.RemoteHead) {
                description = `Remote branch at ${ref.commit}`;
            }
            return { label: ref.name || ref.commit, description: description };
        });
        window.showQuickPick(picks, { placeHolder: `Select a ref to see it's history` }).then(item => {
            this._viewProvider.branch = item.label;
            this.viewHistory();
        });
    }

    @command('githd.inputRef')
    async inputRef(): Promise<void> {
        window.showInputBox( { placeHolder: `Input a ref (sha1) to see it's committed files` }).then(ref => {
            this._fileProvider.update(ref);
        });
    }

    @command('githd.openCommittedFile')
    async openCommittedFile(file: git.CommittedFile): Promise<void> {
        let ref = this._fileProvider.ref;
        let left = toGitUri(file.uri, ref + '~');
        let right = toGitUri(file.uri, ref);
        return await commands.executeCommand<void>('vscode.diff', left, right, ref + ' ' + file.relativePath, { preview: true });
    }

    @command('githd.selectCommittedFilesView')
    async selectCommittedFilesView(): Promise<void> {
        const picks = ['Explorer', 'SCM'];
        window.showQuickPick(picks, { placeHolder: `Select the committed files view` }).then(item => {
            selectCommittedFilesView(item);
        });
    }

    @command('githd.setExplorerViewWithFolder')
    async setExplorerViewWithFolder(): Promise<void> {
        const picks = ['Yes', 'No'];
        window.showQuickPick(picks, { placeHolder: `Set if the committed files show with folder or not` }).then(item => {
            setExplorerViewWithFolder(item);
        });
    }
}