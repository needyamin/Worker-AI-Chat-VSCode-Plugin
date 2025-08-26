import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { marked } from 'marked';
import hljs from 'highlight.js';  // Change import style

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'worker-ai-chat.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
        // Configure marked with syntax highlighting
        marked.use({
            async: false,
            gfm: true,
            breaks: true,
            renderer: {
                code(code: string, language: string | undefined): string {
                    if (language && hljs.getLanguage(language)) {
                        try {
                            const highlighted = hljs.highlight(code, {
                                language,
                                ignoreIllegals: true
                            }).value;
                            return highlighted;
                        } catch (error) {
                            console.error('Highlight.js error:', error);
                        }
                    }
                    // Fallback for unknown languages
                    return hljs.highlightAuto(code).value;
                }
            }
        });
    }

    private _formatMessage(text: string): string {
        // Process regular text and code blocks separately
        const segments = text.split(/(```\w+[\s\S]*?```)/g);
        
        // Process each segment
        const processedSegments = segments.map(segment => {
            if (segment.startsWith('```') && segment.endsWith('```')) {
                // This is a code block - process it with syntax highlighting
                const match = segment.match(/^```(\w+)\n([\s\S]*?)```$/);
                if (match) {
                    const [_, lang, code] = match;
                    return `<div class="code-block">
                        <div class="code-header">
                            <span class="language">${lang}</span>
                            <button class="copy-button" onclick="copyCode(this)">Copy</button>
                        </div>
                        <pre><code class="language-${lang}">${this._escapeHtml(code.trim())}</code></pre>
                    </div>`;
                }
            }
            // Regular text - just convert markdown without special code block handling
            return marked.parse(segment, { async: false });
        });

        return processedSegments.join('');
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

        // Get highlight.js styles
        const highlightJsUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'highlight.js', 'styles', 'github-dark.css')
        );

        webviewView.webview.html = this._getHtmlForWebview(highlightJsUri);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async data => {
            if (data.type === 'sendMessage') {
                try {
                    const workerUrl = 'https://gpt-oss-120b.md-yamin-hossain.workers.dev';
                    const response = await fetch(`${workerUrl}?q=${encodeURIComponent(data.message)}`);
                    const answer = await response.text();
                    
                    // Format the response with proper code blocks
                    const formattedAnswer = this._formatMessage(answer);
                    
                    webviewView.webview.postMessage({
                        type: 'receiveMessage',
                        message: formattedAnswer
                    });
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to get response: ' + error);
                }
            }
        });
    }

    private _getHtmlForWebview(highlightJsUri: vscode.Uri) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="${highlightJsUri}">
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .chat-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        padding: 12px;
                    }
                    .messages {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 12px;
                        padding: 10px;
                        scroll-behavior: smooth;
                    }
                    .message {
                        margin: 12px 0;
                        padding: 12px 16px;
                        border-radius: 8px;
                        white-space: pre-wrap;
                        max-width: 85%;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        line-height: 1.5;
                    }
                    .user-message {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        margin-left: auto;
                        border-bottom-right-radius: 4px;
                    }
                    .ai-message {
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        margin-right: auto;
                        border-bottom-left-radius: 4px;
                    }
                    .typing-indicator {
                        display: flex;
                        align-items: center;
                        padding: 12px 16px;
                        border-radius: 8px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        margin: 12px 0;
                        max-width: 100px;
                    }
                    .typing-dots {
                        display: flex;
                        gap: 4px;
                    }
                    .dot {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background-color: var(--vscode-input-placeholderForeground);
                        animation: typing 1.4s infinite;
                    }
                    .dot:nth-child(2) { animation-delay: 0.2s; }
                    .dot:nth-child(3) { animation-delay: 0.4s; }
                    @keyframes typing {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-4px); }
                    }
                    .input-container {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        padding: 12px;
                        background: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-input-border);
                        position: relative;
                    }
                    #messageInput {
                        min-height: 60px;
                        max-height: 200px;
                        padding: 12px;
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                        resize: vertical;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        line-height: 1.5;
                        border-radius: 6px;
                        transition: border-color 0.2s ease;
                    }
                    #messageInput:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                    }
                    .input-row {
                        display: flex;
                        gap: 10px;
                        align-items: flex-start;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-size: 13px;
                        font-weight: 500;
                        min-width: 80px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.2s ease;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .send-icon {
                        margin-left: 6px;
                        width: 16px;
                        height: 16px;
                    }
                    .code-block {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        margin: 10px 0;
                        overflow: hidden;
                    }
                    .code-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px;
                        background: var(--vscode-editor-lineHighlightBackground);
                        border-bottom: 1px solid var(--vscode-input-border);
                    }
                    .language {
                        color: var(--vscode-textPreformat-foreground);
                        font-size: 12px;
                        text-transform: uppercase;
                        font-weight: 500;
                    }
                    .copy-button {
                        font-size: 12px;
                        padding: 4px 8px;
                        min-width: 60px;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 3px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    .copy-button:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .copy-button:disabled {
                        opacity: 0.6;
                        cursor: default;
                    }
                    pre {
                        margin: 0;
                        padding: 12px 16px;
                        overflow-x: auto;
                        background: var(--vscode-editor-background);
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        line-height: 1.5;
                        tab-size: 4;
                    }
                    .hljs {
                        background: transparent !important;
                        padding: 0 !important;
                    }
                </style>
            </head>
            <body>
                <div class="chat-container">
                    <div class="messages" id="messageContainer"></div>
                    <div class="input-container">
                        <textarea 
                            id="messageInput" 
                            placeholder="Ask me anything... (Press Shift+Enter for new line, Enter to send)"
                        ></textarea>
                        <div class="input-row">
                            <button id="sendButton" onclick="sendMessage()">
                                Send
                                <svg class="send-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15 8L1 15L3 8L1 1L15 8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
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

                    function createTypingIndicator() {
                        const div = document.createElement('div');
                        div.className = 'typing-indicator';
                        const html = 
                            '<div class="typing-dots">' +
                            '<div class="dot"></div>' +
                            '<div class="dot"></div>' +
                            '<div class="dot"></div>' +
                            '</div>';
                        div.innerHTML = html;
                        return div;
                    }

                    function sendMessage() {
                        const message = messageInput.value.trim();
                        if (message) {
                            const sendButton = document.getElementById('sendButton');
                            sendButton.disabled = true;
                            
                            // Add user message
                            addMessage('user', message);
                            
                            // Add typing indicator
                            const typingIndicator = createTypingIndicator();
                            messageContainer.appendChild(typingIndicator);
                            messageContainer.scrollTop = messageContainer.scrollHeight;
                            
                            // Clear input
                            messageInput.value = '';
                            
                            // Send message
                            vscode.postMessage({
                                type: 'sendMessage',
                                message: message
                            });
                        }
                    }

                    function addMessage(sender, text) {
                        const div = document.createElement('div');
                        div.className = \`message \${sender}-message\`;
                        div.innerHTML = text;
                        messageContainer.appendChild(div);
                        messageContainer.scrollTop = messageContainer.scrollHeight;
                        
                        // Initialize syntax highlighting for new code blocks
                        div.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'receiveMessage') {
                            // Remove typing indicator
                            const typingIndicator = document.querySelector('.typing-indicator');
                            if (typingIndicator) {
                                typingIndicator.remove();
                            }
                            
                            // Add AI response
                            addMessage('ai', message.message);
                            
                            // Re-enable send button
                            const sendButton = document.getElementById('sendButton');
                            if (sendButton) {
                                sendButton.disabled = false;
                            }
                        }
                    });

                    function copyCode(button) {
                        const codeBlock = button.closest('.code-block').querySelector('code');
                        const text = codeBlock.textContent;
                        
                        navigator.clipboard.writeText(text).then(() => {
                            const originalText = button.textContent;
                            button.textContent = 'Copied!';
                            button.disabled = true;
                            
                            setTimeout(() => {
                                button.textContent = originalText;
                                button.disabled = false;
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy code:', err);
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }
}