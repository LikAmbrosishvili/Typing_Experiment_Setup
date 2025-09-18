"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const INTERVAL_MS = new Array(20).fill(20000);
//const SUGGESTION_LENGTH = [10,10,10, 9,9,9, 8,8,8, 7,7,7, 6,6,6, 5,5,5, 4,4,4, 3,3,3, 2,2,2, 1,1,1, 1, 1, 1, 1, 1, 1, 1, ];
const SUGGESTION_LENGTH = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10];
//const SUGGESTION_LENGTH = [5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5, 5, 5, 5, 5, 5, 5, 5, ];
//const SUGGESTION_LENGTH = [1, 5, 8, 9, 10, 2, 3, 1, 2, 6, 8, 9, 1, 2, 3, 10, 7, 1, 4, 10, 1, 1, 1, 3, 4, 5, 3, 7];
let paramIndex = 0;
let isFeedbackActive = false;
const referenceText = `Boska Komedia

Dla której prócz tych, co rym nie wylicza,
Umarli Turnus, Kamilla dziewicza.
Podłą wilczycę, jej plemię wszeteczne,

Przepędzi z grodów jego ręka chrobra,
W końcu w triumfie strąci ją do piekła,
Skąd pierwsza zazdrość na świat ją wywlekła.

Teraz ci radzę dla twojego dobra,
Idź za mną, będę twoim przewodnikiem 
I przeprowadzę przez królestwo wieczne.

Tam płacz posłyszysz z rozpaczy wykrzykiem,
Tam starożytne ujrzysz potępieńce,
Co o śmierć drugą wołają w swej męce, 
`;
let csvFilePath;
let sliderPanel;
let poemPanel;
function activate(context) {
    const sessionFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath || context.extensionPath;
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    csvFilePath = path.join(sessionFolder, `adversity_${ts}.csv`);
    fs.writeFileSync(csvFilePath, 'unix_timestamp,adversity,suggestion_preference,suggestion_relevance,event_type,suggestion_text,suggestion_rating\n');
    // ---- utility: single place to append CSV rows
    function logEvent(event_type, opts) {
        const now = typeof opts?.ts === 'number' ? opts.ts : Math.floor(Date.now());
        const row = [
            now,
            opts?.adversity ?? '',
            opts?.pref ?? '',
            opts?.relevance ?? '',
            event_type,
            opts?.suggestion_text ? `"${opts.suggestion_text.replace(/"/g, '""')}"` : '',
            opts?.rating ?? ''
        ].join(',') + '\n';
        try {
            fs.appendFileSync(csvFilePath, row, 'utf-8');
        }
        catch { /* no-op */ }
    }
    function showPoemPanel() {
        if (poemPanel) {
            poemPanel.reveal();
            return;
        }
        poemPanel = vscode.window.createWebviewPanel('poemTask', 'Task: Copy the Poem', vscode.ViewColumn.Beside, { retainContextWhenHidden: true });
        poemPanel.webview.html = `
      <html><body style="font-family:sans-serif;">
        <h2>Type the poem below</h2>
        <pre style="background:#fdfdfd; color:#111; padding:1em; font-size:1.1em;">

${referenceText}
        </pre>
      </body></html>
    `;
        poemPanel.onDidDispose(() => poemPanel = undefined, null, context.subscriptions);
    }
    context.subscriptions.push(vscode.commands.registerCommand('extension.showPoemTask', showPoemPanel));
    showPoemPanel();
    // ---- periodic adversity/relevance panel (kept as-is)
    function showSliderPanel() {
        if (sliderPanel)
            return;
        isFeedbackActive = true;
        sliderPanel = vscode.window.createWebviewPanel('adversitySlider', 'How are you doing right now?', vscode.ViewColumn.Active, { enableScripts: true });
        sliderPanel.webview.html = `
    <!DOCTYPE html>
    <html>
      <body style="padding:2em; text-align:center; font-family:sans-serif; color: white; background-color: #1e1e1e;">
        <h2>Your Current State</h2>

        <!-- Adversity -->
        <div style="margin-top: 2em;">
          <label for="adv" style="font-weight:bold;">What is your level of adversity?</label><br>
          <input id="adv" type="range" min="0" max="6" value="3" style="width: 60%;">
          <div style="display: flex; justify-content: space-between; width: 60%; margin: auto; font-size: 0.8em;">
            <span>None</span><span>Very Slight</span><span>Slight</span><span>Moderate</span><span>Quite</span><span>Very</span><span>Extreme</span>
          </div>
        </div>

        <!-- Relevance -->
        <div style="margin-top: 2em;">
          <label for="rel" style="font-weight:bold;">How relevant are the suggestions?</label><br>
          <input id="rel" type="range" min="0" max="6" value="3" style="width: 60%;">
          <div style="display: flex; justify-content: space-between; width: 60%; margin: auto; font-size: 0.8em;">
            <span>None</span><span>Very Slight</span><span>Slight</span><span>Moderate</span><span>Quite</span><span>Very</span><span>Extreme</span>
          </div>
        </div>

        <button id="submitBtn" style="margin-top: 3em; padding: 0.5em 1.2em;">Submit</button>

        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('submitBtn').onclick = () => {
            vscode.postMessage({
              type: 'adversitySubmit',
              unixTimestamp: Math.floor(Date.now()),
              adversity: document.getElementById('adv').value,
              suggestionPreference:"",
              suggestionRelevance: document.getElementById('rel').value
            });
          };
        </script>
      </body>
    </html>
    `;
        sliderPanel.webview.onDidReceiveMessage(msg => {
            if (msg.type === 'adversitySubmit') {
                logEvent('submit', {
                    ts: msg.unixTimestamp,
                    adversity: String(msg.adversity ?? ''),
                    relevance: String(msg.suggestionRelevance ?? '')
                });
                sliderPanel?.dispose();
            }
        }, undefined, context.subscriptions);
        sliderPanel.onDidDispose(() => {
            isFeedbackActive = false;
            sliderPanel = undefined;
        });
    }
    setInterval(() => {
        if (!isFeedbackActive)
            showSliderPanel();
    }, 60000);
    function getRatingAndExecute(suggestion, position, editor, action) {
        isFeedbackActive = true;
        const options = [
            '0  Much less frequent',
            '1  Moderately less frequent',
            '2  Slightly less frequent',
            '3  About the same',
            '4  Slightly more frequent',
            '5  Moderately more frequent',
            '6  Much more frequent'
        ];
        vscode.window.showQuickPick(options, {
            placeHolder: 'Would you like more or fewer suggestions?'
        }).then(rating => {
            const ts = Math.floor(Date.now());
            // If user chose a rating, log with that; otherwise record dismissal of preference prompt.
            if (rating) {
                const baseEvent = action === 'accept' ? 'accept_clicked'
                    : action === 'reject' ? 'reject_clicked'
                        : action === 'ignored_no_reveal' ? 'ignored_no_reveal'
                            : 'reveal_dismissed';
                logEvent(baseEvent, { ts, suggestion_text: suggestion, rating: `"${rating}"` });
                if (action === 'accept') {
                    editor.edit(editBuilder => editBuilder.insert(position, suggestion));
                }
            }
            else {
                // Still log the path (no rating selected)
                const dismissedEvent = action === 'accept' ? 'accept_clicked_pref_prompt_dismissed'
                    : action === 'reject' ? 'reject_clicked_pref_prompt_dismissed'
                        : action === 'ignored_no_reveal' ? 'ignored_no_reveal_pref_prompt_dismissed'
                            : 'reveal_dismissed_pref_prompt_dismissed';
                logEvent(dismissedEvent, { ts, suggestion_text: suggestion });
            }
            isFeedbackActive = false;
        });
    }
    // ---- Show a center popup, track shown, track ignored paths, always ask frequency
    function showSuggestionPopup(suggestion, position, editor) {
        // Log immediately that the suggestion appeared (for "which suggestion was ignored")
        logEvent('suggestion_shown', { suggestion_text: suggestion });
        vscode.window.showInformationMessage('Recommendation Ready!', { modal: true }, 'Reveal')
            .then(action => {
            if (action === 'Reveal') {
                vscode.window.showInformationMessage(suggestion, 'Accept', 'Reject').then(choice => {
                    if (choice === 'Accept') {
                        getRatingAndExecute(suggestion, position, editor, 'accept');
                    }
                    else if (choice === 'Reject') {
                        getRatingAndExecute(suggestion, position, editor, 'reject');
                    }
                    else {
                        // Closed/dismissed without choosing Accept/Reject
                        getRatingAndExecute(suggestion, position, editor, 'reveal_dismissed');
                    }
                });
            }
            else {
                // User canceled/closed the first modal (never revealed)
                getRatingAndExecute(suggestion, position, editor, 'ignored_no_reveal');
            }
        });
    }
    function scheduleNextSuggestion() {
        const interval = INTERVAL_MS[paramIndex % INTERVAL_MS.length];
        setTimeout(() => {
            if (!isFeedbackActive) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const doc = editor.document;
                    const pos = editor.selection.active;
                    const allRef = referenceText.split('\n');
                    if (pos.line < allRef.length) {
                        const lineText = doc.lineAt(pos.line).text;
                        const refLine = allRef[pos.line] || '';
                        const len = SUGGESTION_LENGTH[paramIndex % SUGGESTION_LENGTH.length];
                        const remainingText = refLine.substring(lineText.length).trimStart();
                        const suggestion = remainingText.substring(0, len).trim();
                        if (suggestion) {
                            showSuggestionPopup(suggestion, pos, editor);
                            paramIndex++;
                        }
                    }
                }
            }
            scheduleNextSuggestion();
        }, interval);
    }
    scheduleNextSuggestion();
}
function deactivate() { }
//# sourceMappingURL=extension.js.map