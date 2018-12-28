const vscode = require('vscode');
const path = require('path');

class SelectResultsPanel {
    constructor(panel, extensionPath) {
        this._disposables = [];
        this._dbList = [];
        this._dbIndex = {};
        this._dbIndexById = {};
        this._panel = panel;
        this._extensionPath = extensionPath;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'toggle-open-results':
                    vscode.window.showErrorMessage(message.text);
                    this._dbIndexById[message.text].isOpened = !this._dbIndexById[message.text].isOpened;
                    this._update();
                    return;
                case 'open-all-results':
                    this._dbList.forEach(db => {
                        db.isOpened = true;
                    });
                    this._update();
                    return;
            }
        }, null, this._disposables);
    }

    static createOrShow(extensionPath) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : vscode.ViewColumn.One;
        const panel = vscode.window.createWebviewPanel(SelectResultsPanel.viewType, "Select SQL results", column, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionPath, 'resources'))
            ]
        });

        return new SelectResultsPanel(panel, extensionPath);
    }

    addDatabases(dbList) {
        let nextId = 100;
        dbList.forEach(srcDb => {
            const db = {
                id: `db${nextId++}`,
                name: srcDb.name,
                schema: srcDb.schema,
                server:srcDb.server,
                isStarted: false,
                isSucceeded: false,
                result: undefined,
                errors: [],
                isOpened: false,
                duration: ''
            };

            this._dbList.push(db)
            this._dbIndex[db.name] = db
            this._dbIndexById[db.id] = db
        });

        this._update();
    }

    addError(db, errMsg) {
        this._dbIndex[db.name].errors.push(errMsg);
        this._update();
    }

    markAsStarted(db) {
        this._dbIndex[db.name].isStarted = true;
        this._update();
    }

    markAsSucceeded(db) {
        this._dbIndex[db.name].isSucceeded = true;
        this._update();
    }

    appendResults(db, result) {
        this._dbIndex[db.name].result = result;
        this._update();
    }

    setDuration(db, duration) {
        this._dbIndex[db.name].duration = duration;
//        this._update();
    }

    dispose() {
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    _update() {
        this._panel.title = 'Select SQL results';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    _getHtmlForWebview() {
        let completedCnt = 0;
        this._dbList.forEach(db => {
            if (db.result || db.errors.length) {
                completedCnt++;
            }
        });

        let completedPercent = 0;
        if (this._dbList.length) {
            completedPercent = completedCnt * 100 / this._dbList.length;
        }

        let liDbListStr = '';
        this._dbList.forEach(db => {
            let img = '';
            if (db.isStarted) {
                let gifUri = this._makeAbsoluteResUri('dark', 'in_progress.svg');
                if (db.isSucceeded)
                    gifUri = this._makeAbsoluteResUri('dark', 'succeeded.svg')
                if (db.errors.length !== 0)
                    gifUri = this._makeAbsoluteResUri('dark', 'failed.svg')
            
                img = `<img src="${gifUri}" width="18"/>`;
            }

            liDbListStr += `<li><span class="caret" id=${db.id}>${img} ${db.name} - ${db.schema}/${db.server} - ${0+1}</span>`;
            
            if (db.result) {
                let rowsCnt = db.result.rows.length;

                if (db.result.rows.length === 1 && db.result.rows[0].length === 1 &&
                    db.result.metaData && db.result.metaData.length === 1 &&
                    db.result.metaData[0].name.toUpperCase().startsWith('COUNT')) {
                    rowsCnt = db.result.rows[0][0];
                }

                liDbListStr += `<span class="rescnt">${rowsCnt}</span>`;
            }

            liDbListStr += `</li>`;

            if (db.isOpened && db.result) {
                liDbListStr += `<table>`;
                db.result.rows.forEach(row => {
                    liDbListStr += `<tr>`;
                    row.forEach(cell => {
                        liDbListStr += `<td>${cell}</td>`
                    });
                    liDbListStr += `</tr>`;
                });
                liDbListStr += `</table>`;
            }

            if(db.isOpened && db.errors.length !== 0) {
                liDbListStr += `<ul>`;
                db.errors.forEach(errMsg => {
                    liDbListStr += `<li>${img} ${errMsg}</li>`;
                });

                liDbListStr += `</ul>`;
            }
        });


        return (
            `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        ul, #dbList {
                            list-style-type: none;
                        }
                        #dbList {
                            margin: 0;
                            padding: 0;
                        }
                        .rescnt {
                            float: right;
                        }
                        .caret {
                            cursor: pointer;
                            /*user-select: none;*/
                        }
                        .caret::before {
                            content: "\\25B6";
                            color: black;
                            display: inline-block;
                            margin-right: 6px;
                        }
                        .caret-down::before {
                            -ms-transform: rotate(90deg); /* IE 9 */
                            -webkit-transform: rotate(90deg); /* Safari */'
                            transform: rotate(90deg);  
                        }
                        .nested {
                            display: none;
                        }
                        .active {
                            display: block;
                        }
                    </style>
                    <title>Select Results</title>
                </head>
                <body>
                    <progress max="100" value="${completedPercent}">
                      progressStr
                    </progress>
                    <button onclick="onOpenAllClicked();">Раскрыть все</button>
                    <ul id="dbList">
                        ${liDbListStr}
                    </ul>
                    <script>
                        const vscode = acquireVsCodeApi();

                        var togglers = document.getElementsByClassName("caret");
                        var i;

                        for (i = 0; i < togglers.length; i++) {
                            togglers[i].addEventListener("click", function() {
                                //this.parentElement.querySelector(".nested").classList.toggle("active");
                                //this.classList.toggle("caret-down");
                                vscode.postMessage({
                                    command: 'toggle-open-results',
                                    text: this.id
                                });
                            });
                        }

                        function onOpenAllClicked(){
                            vscode.postMessage({
                                command: 'open-all-results',
                                text: ''
                            });
                        }
                    </script>
                </body>
            </html>`
        );
    }

    _makeAbsoluteResUri(theme, res) {
        const resPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, "resources", theme, res));
        return resPathOnDisk.with({ scheme: 'vscode-resource' });
    }
}

SelectResultsPanel.viewType = 'selectSqlResults';

module.exports = {
	SelectResultsPanel
}
