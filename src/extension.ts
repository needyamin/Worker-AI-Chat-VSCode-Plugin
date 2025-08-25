import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Worker AI Chat extension is now active!');

    const provider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatViewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true }
            }
        )
    );

    let disposable = vscode.commands.registerCommand('worker-ai-chat.askAI', async () => {
        const userInput = await vscode.window.showInputBox({
            prompt: 'Ask GPT-OSS-120B anything!',
            placeHolder: 'Enter your question here...'
        });
        
        if (!userInput) { return; }

        try {
            const output = vscode.window.createOutputChannel("Worker AI Chat");
            output.show(true);
            output.appendLine("User: " + userInput);
            output.appendLine("");

            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Calling Worker AI...",
                cancellable: false
            }, async () => {
                const workerUrl = 'https://gpt-oss-120b.md-yamin-hossain.workers.dev';
                const res = await fetch(`${workerUrl}?q=${encodeURIComponent(userInput)}`);
                
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                
                const aiText = await res.text();
                output.appendLine("AI: " + aiText);
                output.appendLine("");
            });

        } catch (err: any) {
            const errorMsg = err?.message || String(err);
            vscode.window.showErrorMessage('Error calling Worker AI: ' + errorMsg);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
