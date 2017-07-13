'use strict';

import { ExtensionContext, workspace } from 'vscode'
import { createFileProvider, FileProvider, explorerViewName } from './model';
import { CommandCenter } from './commands';
import { HistoryViewProvider } from './historyViewProvider';
import { CommittedFilesProvider } from './committedFilesProvider';

export function activate(context: ExtensionContext) {
    let getConfigFn = () => {
        return {
            userExplorer: <boolean>workspace.getConfiguration('githd.committedFilesView').get('useExplorer'),
            withFolder: <boolean>workspace.getConfiguration('githd.explorerView').get('withFolder'),
            commitsCount: <number>workspace.getConfiguration('githd.logView').get('commitsCount')
        };
    };
    let config = getConfigFn();
    let fileProvider: FileProvider = createFileProvider(config.userExplorer, config.withFolder);
    let historyViewProvider = new HistoryViewProvider(fileProvider, config.commitsCount);
    let commandCenter = new CommandCenter(fileProvider, historyViewProvider);

    workspace.onDidChangeConfiguration(() => {
        let newConfig = getConfigFn();
        if (newConfig.userExplorer !== config.userExplorer) {
            let ref = fileProvider.ref;
            fileProvider.dispose();
            fileProvider = createFileProvider(newConfig.userExplorer, newConfig.withFolder);
            historyViewProvider.fileProvider = fileProvider;
            commandCenter.fileProvider = fileProvider;
            context.subscriptions.push(fileProvider);
            fileProvider.update(ref);
        } else if (config.userExplorer && newConfig.withFolder !== config.withFolder) {
            (fileProvider as CommittedFilesProvider).withFolder = newConfig.withFolder;
        }
        historyViewProvider.commitsCount = newConfig.commitsCount;
        config = newConfig;
    }, null, context.subscriptions);

    context.subscriptions.push(commandCenter, historyViewProvider, fileProvider);
}

export function deactivate() {
}

export function selectCommittedFilesView(viewName: string): void {
    workspace.getConfiguration('githd').update('committedFilesView.useExplorer', viewName === 'Explorer', false);
}

export function setExplorerViewWithFolder(withFolder: string): void {
    workspace.getConfiguration('githd').update('explorerView.withFolder', withFolder.toLowerCase() === 'yes', false);
}