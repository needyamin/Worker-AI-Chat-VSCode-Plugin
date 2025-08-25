import * as vscode from 'vscode';
import fetch from 'node-fetch';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'worker-ai-chat.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'ask') {
                try {
                    const workerUrl = 'https://gpt-oss-120b.md-yamin-hossain.workers.dev';
                    const res = await fetch(`${workerUrl}?q=${encodeURIComponent(msg.text)}`);
                    const aiText = await res.text();
                    webviewView.webview.postMessage({ type: 'answer', text: aiText });
                } catch (e: any) {
                    webviewView.webview.postMessage({ type: 'answer', text: 'Error: ' + e.message });
                }
            }
        });
    }

    getHtml() {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <body>
            <div id="messages" style="height:300px;overflow:auto;border:1px solid #ccc;padding:8px;margin-bottom:8px;"></div>
            <input id="input" type="text" style="width:80%;" placeholder="Ask something..." />
            <button id="send">Send</button>
            <script>
                const vscode = acquireVsCodeApi();
                const messages = document.getElementById('messages');
                document.getElementById('send').onclick = () => {
                    const input = document.getElementById('input');
                    if (input.value) {
                        messages.innerHTML += '<div><b>You:</b> ' + input.value + '</div>';
                        vscode.postMessage({ type: 'ask', text: input.value });
                        input.value = '';
                    }
                };
                window.addEventListener('message', event => {
                    const msg = event.data;
                    if (msg.type === 'answer') {
                        messages.innerHTML += '<div><b>AI:</b> ' + msg.text + '</div>';
                        messages.scrollTop = messages.scrollHeight;
                    }
                });
            </script>
        </body>
        </html>
        `;
    }
}