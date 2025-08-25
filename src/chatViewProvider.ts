import * as vscode from 'vscode';
import fetch from 'node-fetch';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'worker-ai-chat.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
    }

    private _formatMessage(text: string): string {
        return text;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async data => {
            if (data.type === 'sendMessage') {
                try {
                    const workerUrl = 'https://gpt-oss-120b.md-yamin-hossain.workers.dev';
                    const response = await fetch(`${workerUrl}?q=${encodeURIComponent(data.message)}`);
                    const answer = await response.text();
                    
                    webviewView.webview.postMessage({
                        type: 'receiveMessage',
                        message: answer
                    });
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to get response: ' + error);
                }
            }
        });
    }

    private _getHtmlForWebview() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .chat-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        padding: 10px;
                    }
                    .messages {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 10px;
                        padding: 10px;
                    }
                    .message {
                        margin: 8px 0;
                        padding: 8px 12px;
                        border-radius: 6px;
                        white-space: pre-wrap;
                    }
                    .user-message {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        align-self: flex-end;
                    }
                    .ai-message {
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        align-self: flex-start;
                    }
                    .input-container {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-input-border);
                    }
                    #messageInput {
                        min-height: 80px;
                        max-height: 200px;
                        padding: 8px;
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                        resize: vertical;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        line-height: 1.4;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        cursor: pointer;
                        align-self: flex-end;
                        min-width: 80px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="chat-container">
                    <div class="messages" id="messageContainer"></div>
                    <div class="input-container">
                        <textarea 
                            id="messageInput" 
                            placeholder="Type your message here... (Press Shift+Enter for new line, Enter to send)"
                        ></textarea>
                        <button onclick="sendMessage()">Send</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const messageContainer = document.getElementById('messageContainer');
                    const messageInput = document.getElementById('messageInput');

                    // Handle Enter key for sending and Shift+Enter for new line
                    messageInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });

                    // Auto-resize textarea based on content
                    messageInput.addEventListener('input', function() {
                        this.style.height = 'auto';
                        const height = Math.min(this.scrollHeight, 200);
                        this.style.height = height + 'px';
                    });

                    function sendMessage() {
                        const message = messageInput.value.trim();
                        if (message) {
                            addMessage('user', message);
                            vscode.postMessage({
                                type: 'sendMessage',
                                message: message
                            });
                            messageInput.value = '';
                        }
                    }

                    function addMessage(sender, text) {
                        const div = document.createElement('div');
                        div.className = \`message \${sender}-message\`;
                        div.innerHTML = text; // Use innerHTML to render formatted markdown
                        messageContainer.appendChild(div);
                        messageContainer.scrollTop = messageContainer.scrollHeight;
                    }
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'receiveMessage') {
                            addMessage('ai', message.message);
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}