import React from 'react';
let codemirror = require('codemirror');
var Typo = require('typo-js');

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Utility function that allows modes to be combined. The mode given
// as the base argument takes care of most of the normal mode
// functionality, but a second (typically simple) mode is used, which
// can override the style of text. Both modes get to parse all of the
// text, but when both assign a non-null style to a piece of code, the
// overlay wins, unless the combine argument was true and not overridden,
// or state.overlay.combineTokens was true, in which case the styles are
// combined.

(function(mod) {
    if (
        typeof exports == 'object' &&
        typeof module == 'object' // CommonJS
    )
        mod(require('codemirror'));
    else if (
        typeof define == 'function' &&
        define.amd // AMD
    )
        define(['codemirror'], mod); // Plain browser env
    else mod(CodeMirror);
})(function(CodeMirror) {
    'use strict';
    CodeMirror.overlayMode = function(base, overlay, combine) {
        return {
            startState: function() {
                return {
                    base: CodeMirror.startState(base),
                    overlay: CodeMirror.startState(overlay),
                    basePos: 0,
                    baseCur: null,
                    overlayPos: 0,
                    overlayCur: null,
                    streamSeen: null
                };
            },
            copyState: function(state) {
                return {
                    base: CodeMirror.copyState(base, state.base),
                    overlay: CodeMirror.copyState(overlay, state.overlay),
                    basePos: state.basePos,
                    baseCur: null,
                    overlayPos: state.overlayPos,
                    overlayCur: null
                };
            },

            token: function(stream, state) {
                if (
                    stream != state.streamSeen ||
                    Math.min(state.basePos, state.overlayPos) < stream.start
                ) {
                    state.streamSeen = stream;
                    state.basePos = state.overlayPos = stream.start;
                }

                if (stream.start == state.basePos) {
                    state.baseCur = base.token(stream, state.base);
                    state.basePos = stream.pos;
                }
                if (stream.start == state.overlayPos) {
                    stream.pos = stream.start;
                    state.overlayCur = overlay.token(stream, state.overlay);
                    state.overlayPos = stream.pos;
                }
                stream.pos = Math.min(state.basePos, state.overlayPos);

                // state.overlay.combineTokens always takes precedence over combine,
                // unless set to null
                if (state.overlayCur == null) return state.baseCur;
                else if (
                    (state.baseCur != null && state.overlay.combineTokens) ||
                    (combine && state.overlay.combineTokens == null)
                )
                    return state.baseCur + ' ' + state.overlayCur;
                else return state.overlayCur;
            },

            indent:
                base.indent &&
                function(state, textAfter) {
                    return base.indent(state.base, textAfter);
                },
            electricChars: base.electricChars,

            innerMode: function(state) {
                return {state: state.base, mode: base};
            },

            blankLine: function(state) {
                var baseToken, overlayToken;
                if (base.blankLine) baseToken = base.blankLine(state.base);
                if (overlay.blankLine) overlayToken = overlay.blankLine(state.overlay);

                return overlayToken == null
                    ? baseToken
                    : combine && baseToken != null
                      ? baseToken + ' ' + overlayToken
                      : overlayToken;
            }
        };
    };
});

/**
 * CodeMirror Spell Checker
 * @param {*object} options
 */
function CodeMirrorSpellChecker(options) {
    // Initialize
    options = options || {};

    // Verify
    if (
        typeof options.codeMirrorInstance !== 'function' ||
        typeof options.codeMirrorInstance.defineMode !== 'function'
    ) {
        console.log(
            'CodeMirror Spell Checker: You must provide an instance of CodeMirror via the option `codeMirrorInstance`'
        );
        return;
    }

    // Because some browsers don't support this functionality yet
    if (!String.prototype.includes) {
        String.prototype.includes = function() {
            'use strict';
            return String.prototype.indexOf.apply(this, arguments) !== -1;
        };
    }

    // Define the new mode
    options.codeMirrorInstance.defineMode('spell-checker', function(config) {
        // Load AFF/DIC data
        if (!CodeMirrorSpellChecker.aff_loading) {
            CodeMirrorSpellChecker.aff_loading = true;
            var xhr_aff = new XMLHttpRequest();
            xhr_aff.open(
                'GET',
                'https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.aff',
                true
            );
            xhr_aff.onload = function() {
                if (xhr_aff.readyState === 4 && xhr_aff.status === 200) {
                    CodeMirrorSpellChecker.aff_data = xhr_aff.responseText;
                    CodeMirrorSpellChecker.num_loaded++;

                    if (CodeMirrorSpellChecker.num_loaded == 2) {
                        CodeMirrorSpellChecker.typo = new Typo(
                            'en_US',
                            CodeMirrorSpellChecker.aff_data,
                            CodeMirrorSpellChecker.dic_data,
                            {
                                platform: 'any'
                            }
                        );
                    }
                }
            };
            xhr_aff.send(null);
        }

        if (!CodeMirrorSpellChecker.dic_loading) {
            CodeMirrorSpellChecker.dic_loading = true;
            var xhr_dic = new XMLHttpRequest();
            xhr_dic.open(
                'GET',
                'https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.dic',
                true
            );
            xhr_dic.onload = function() {
                if (xhr_dic.readyState === 4 && xhr_dic.status === 200) {
                    CodeMirrorSpellChecker.dic_data = xhr_dic.responseText;
                    CodeMirrorSpellChecker.num_loaded++;

                    if (CodeMirrorSpellChecker.num_loaded == 2) {
                        CodeMirrorSpellChecker.typo = new Typo(
                            'en_US',
                            CodeMirrorSpellChecker.aff_data,
                            CodeMirrorSpellChecker.dic_data,
                            {
                                platform: 'any'
                            }
                        );
                    }
                }
            };
            xhr_dic.send(null);
        }

        // Define what separates a word
        var rx_word = /^[^!\"#$%&()*+,\-./:;<=>?@\[\\\]^_`{|}~\s]+/;
        var rx_link = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})/;

        var rx_ignore_num = /^[0-9]+$/;

        var customWords = [];

        if (options.customWords && options.customWords instanceof Array) {
            customWords = options.customWords;
        }

        // Create the overlay and such
        var overlay = {
            token: function(stream) {
                var word = stream.match(rx_word, true);
                var hasLink = stream.string.match(rx_link);
                var link = hasLink && hasLink[0];

                var ignore = link && link.match(word);

                if (word && !ignore) {
                    word = word[0]; // regex match body
                    if (
                        !word.match(rx_ignore_num) &&
                        CodeMirrorSpellChecker.typo &&
                        !CodeMirrorSpellChecker.typo.check(word) &&
                        !~customWords.indexOf(word)
                    )
                        return 'spell-error'; // CSS class: cm-spell-error
                } else {
                    stream.next(); // skip non-word character
                }

                return null;
            }
        };

        var mode = options.codeMirrorInstance.getMode(
            config,
            config.backdrop || 'text/plain'
        );

        return options.codeMirrorInstance.overlayMode(mode, overlay, true);
    });
}

// Initialize data globally to reduce memory consumption
CodeMirrorSpellChecker.num_loaded = 0;
CodeMirrorSpellChecker.aff_loading = false;
CodeMirrorSpellChecker.dic_loading = false;
CodeMirrorSpellChecker.aff_data = '';
CodeMirrorSpellChecker.dic_data = '';
CodeMirrorSpellChecker.typo;

export default class CodeMirror extends React.Component {
    constructor(props) {
        super(props);

        this.hydrated = false;
        this.continuePreSet = false;
        this.continuePreChange = false;

        this.onBeforeChangeCb = () => {
            this.continuePreChange = true;
        };

        this.onBeforeSetCb = () => {
            this.continuePreSet = true;
        };

        this.initCb = () => {
            if (this.props.editorDidConfigure) {
                this.props.editorDidConfigure(this.editor);
            }
        };
    }

    componentWillMount() {
        if (this.props.editorWillMount) {
            this.props.editorWillMount();
        }
    }

    componentDidMount() {
        /* deprecation warnings per 1.0.0 release */
        if (this.props.onValueChange) {
            console.warn(
                '`onValueChange` has been deprecated. Please use `onChange` instead'
            );
        }

        if (this.props.onValueSet) {
            console.warn('`onValueSet` has been deprecated. Please use `onSet` instead');
        }
        /* end deprecation warnings per 1.0.0 release */

        if (this.props.defineMode) {
            if (this.props.defineMode.name && this.props.defineMode.fn) {
                codemirror.defineMode(
                    this.props.defineMode.name,
                    this.props.defineMode.fn
                );
            }
        }

        this.editor = codemirror(this.ref);

        CodeMirrorSpellChecker({
            codeMirrorInstance: codemirror
        });

        this.editor.on('beforeChange', (cm, changeObj) => {
            if (this.props.onBeforeChange && this.hydrated) {
                this.props.onBeforeChange(this.editor, changeObj, this.onBeforeChangeCb);
            }
        });

        this.editor.on('change', (cm, metadata) => {
            if (this.props.onChange && this.hydrated) {
                if (this.props.onBeforeChange) {
                    if (this.continuePreChange) {
                        this.props.onChange(
                            this.editor,
                            metadata,
                            this.editor.getValue()
                        );
                    }
                } else {
                    this.props.onChange(this.editor, metadata, this.editor.getValue());
                }
            }
        });

        if (this.props.onCursorActivity) {
            this.editor.on('cursorActivity', cm => {
                this.props.onViewportChange(this.editor);
            });
        }

        if (this.props.onViewportChange) {
            this.editor.on('viewportChange', (cm, start, end) => {
                this.props.onViewportChange(this.editor, start, end);
            });
        }

        if (this.props.onGutterClick) {
            this.editor.on('gutterClick', (cm, lineNumber, event) => {
                this.props.onGutterClick(this.editor, lineNumber, event);
            });
        }

        if (this.props.onFocus) {
            this.editor.on('focus', (cm, event) => {
                this.props.onFocus(this.editor, event);
            });
        }

        if (this.props.onBlur) {
            this.editor.on('blur', (cm, event) => {
                this.props.onBlur(this.editor, event);
            });
        }

        if (this.props.onUpdate) {
            this.editor.on('update', (cm, event) => {
                this.props.onUpdate(this.editor, event);
            });
        }

        if (this.props.onKeyDown) {
            this.editor.on('keydown', (cm, event) => {
                this.props.onKeyDown(this.editor, event);
            });
        }

        if (this.props.onKeyUp) {
            this.editor.on('keyup', (cm, event) => {
                this.props.onKeyUp(this.editor, event);
            });
        }

        if (this.props.onKeyPress) {
            this.editor.on('keypress', (cm, event) => {
                this.props.onKeyPress(this.editor, event);
            });
        }

        if (this.props.onDragEnter) {
            this.editor.on('dragenter', (cm, event) => {
                this.props.onDragEnter(this.editor, event);
            });
        }

        if (this.props.onDragOver) {
            this.editor.on('dragover', (cm, event) => {
                this.props.onDragOver(this.editor, event);
            });
        }

        if (this.props.onDrop) {
            this.editor.on('drop', (cm, event) => {
                this.props.onDrop(this.editor, event);
            });
        }

        if (this.props.onSelection) {
            this.editor.on('beforeSelectionChange', (cm, meta) => {
                this.props.onSelection(this.editor, meta.ranges);
            });
        }

        if (this.props.onScroll) {
            this.editor.on('scroll', cm => {
                let meta = this.editor.getScrollInfo();

                this.props.onScroll(this.editor, {
                    x: meta.left,
                    y: meta.top
                });
            });
        }

        if (this.props.onCursor) {
            this.editor.on('cursorActivity', cm => {
                let meta = this.editor.getCursor();

                this.props.onCursor(this.editor, {
                    line: meta.line,
                    ch: meta.ch
                });
            });
        }

        this.hydrate(this.props);

        // commands
        if (this.props.selection) {
            this.editor.setSelections(this.props.selection);
        }

        if (this.props.cursor) {
            this.editor.focus();
            this.editor.setCursor(this.props.cursor);
        }

        if (this.props.scroll) {
            this.editor.scrollTo(this.props.scroll.x, this.props.scroll.y);
        }

        if (this.props.editorDidMount) {
            this.props.editorDidMount(this.editor, this.initCb);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.value !== nextProps.value) {
            this.hydrated = false;
        }

        if (!this.props.resetCursorOnSet) {
            this.cursorPos = this.editor.getCursor();
        }

        this.hydrate(nextProps);

        if (!this.props.resetCursorOnSet) {
            !this.props.autoScrollCursorOnSet &&
            this.props.autoScrollCursorOnSet !== undefined
                ? this.editor.setCursor(this.cursorPos, null, {scroll: false})
                : this.editor.setCursor(this.cursorPos);
        }
    }

    componentWillUnmount() {
        if (this.props.editorWillUnmount) {
            this.props.editorWillUnmount(codemirror);
        }
    }

    hydrate(props) {
        Object.keys(props.options || {}).forEach(key =>
            this.editor.setOption(key, props.options[key])
        );

        if (this.props.editorDidConfigure) {
            this.props.editorDidConfigure(this.editor);
        }

        if (!this.hydrated) {
            this.editor.setValue(props.value || '');

            if (this.props.onBeforeSet) {
                this.props.onBeforeSet(this.editor, this.onBeforeSetCb);
            }

            if (this.props.onBeforeSet) {
                if (this.continuePreSet && this.props.onSet) {
                    this.props.onSet(this.editor, this.editor.getValue());
                }
            } else {
                if (this.props.onSet) {
                    this.props.onSet(this.editor, this.editor.getValue());
                }
            }
        }

        this.hydrated = true;
    }

    render() {
        let className = this.props.className
            ? `react-codemirror2 ${this.props.className}`
            : 'react-codemirror2';

        return <div className={className} ref={self => (this.ref = self)} />;
    }
}
