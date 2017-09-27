'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var codemirror = require('codemirror');
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

(function (mod) {
    if ((typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) == 'object' && (typeof module === 'undefined' ? 'undefined' : _typeof(module)) == 'object' // CommonJS
    ) mod(require('codemirror'));else if (typeof define == 'function' && define.amd // AMD
    ) define(['codemirror'], mod); // Plain browser env
    else mod(CodeMirror);
})(function (CodeMirror) {
    'use strict';

    CodeMirror.overlayMode = function (base, overlay, combine) {
        return {
            startState: function startState() {
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
            copyState: function copyState(state) {
                return {
                    base: CodeMirror.copyState(base, state.base),
                    overlay: CodeMirror.copyState(overlay, state.overlay),
                    basePos: state.basePos,
                    baseCur: null,
                    overlayPos: state.overlayPos,
                    overlayCur: null
                };
            },

            token: function token(stream, state) {
                if (stream != state.streamSeen || Math.min(state.basePos, state.overlayPos) < stream.start) {
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
                if (state.overlayCur == null) return state.baseCur;else if (state.baseCur != null && state.overlay.combineTokens || combine && state.overlay.combineTokens == null) return state.baseCur + ' ' + state.overlayCur;else return state.overlayCur;
            },

            indent: base.indent && function (state, textAfter) {
                return base.indent(state.base, textAfter);
            },
            electricChars: base.electricChars,

            innerMode: function innerMode(state) {
                return { state: state.base, mode: base };
            },

            blankLine: function blankLine(state) {
                var baseToken, overlayToken;
                if (base.blankLine) baseToken = base.blankLine(state.base);
                if (overlay.blankLine) overlayToken = overlay.blankLine(state.overlay);

                return overlayToken == null ? baseToken : combine && baseToken != null ? baseToken + ' ' + overlayToken : overlayToken;
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
    if (typeof options.codeMirrorInstance !== 'function' || typeof options.codeMirrorInstance.defineMode !== 'function') {
        console.log('CodeMirror Spell Checker: You must provide an instance of CodeMirror via the option `codeMirrorInstance`');
        return;
    }

    // Because some browsers don't support this functionality yet
    if (!String.prototype.includes) {
        String.prototype.includes = function () {
            'use strict';

            return String.prototype.indexOf.apply(this, arguments) !== -1;
        };
    }

    // Define the new mode
    options.codeMirrorInstance.defineMode('spell-checker', function (config) {
        // Load AFF/DIC data
        if (!CodeMirrorSpellChecker.aff_loading) {
            CodeMirrorSpellChecker.aff_loading = true;
            var xhr_aff = new XMLHttpRequest();
            xhr_aff.open('GET', 'https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.aff', true);
            xhr_aff.onload = function () {
                if (xhr_aff.readyState === 4 && xhr_aff.status === 200) {
                    CodeMirrorSpellChecker.aff_data = xhr_aff.responseText;
                    CodeMirrorSpellChecker.num_loaded++;

                    if (CodeMirrorSpellChecker.num_loaded == 2) {
                        CodeMirrorSpellChecker.typo = new Typo('en_US', CodeMirrorSpellChecker.aff_data, CodeMirrorSpellChecker.dic_data, {
                            platform: 'any'
                        });
                    }
                }
            };
            xhr_aff.send(null);
        }

        if (!CodeMirrorSpellChecker.dic_loading) {
            CodeMirrorSpellChecker.dic_loading = true;
            var xhr_dic = new XMLHttpRequest();
            xhr_dic.open('GET', 'https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.dic', true);
            xhr_dic.onload = function () {
                if (xhr_dic.readyState === 4 && xhr_dic.status === 200) {
                    CodeMirrorSpellChecker.dic_data = xhr_dic.responseText;
                    CodeMirrorSpellChecker.num_loaded++;

                    if (CodeMirrorSpellChecker.num_loaded == 2) {
                        CodeMirrorSpellChecker.typo = new Typo('en_US', CodeMirrorSpellChecker.aff_data, CodeMirrorSpellChecker.dic_data, {
                            platform: 'any'
                        });
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
            token: function token(stream) {
                var word = stream.match(rx_word, true);
                var hasLink = stream.string.match(rx_link);
                var link = hasLink && hasLink[0];

                var ignore = link && link.match(word);

                if (word && !ignore) {
                    word = word[0]; // regex match body
                    if (!word.match(rx_ignore_num) && CodeMirrorSpellChecker.typo && !CodeMirrorSpellChecker.typo.check(word) && !~customWords.indexOf(word)) return 'spell-error'; // CSS class: cm-spell-error
                } else {
                    stream.next(); // skip non-word character
                }

                return null;
            }
        };

        var mode = options.codeMirrorInstance.getMode(config, config.backdrop || 'text/plain');

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

var CodeMirror = function (_React$Component) {
    _inherits(CodeMirror, _React$Component);

    function CodeMirror(props) {
        _classCallCheck(this, CodeMirror);

        var _this = _possibleConstructorReturn(this, (CodeMirror.__proto__ || Object.getPrototypeOf(CodeMirror)).call(this, props));

        _this.hydrated = false;
        _this.continuePreSet = false;
        _this.continuePreChange = false;

        _this.onBeforeChangeCb = function () {
            _this.continuePreChange = true;
        };

        _this.onBeforeSetCb = function () {
            _this.continuePreSet = true;
        };

        _this.initCb = function () {
            if (_this.props.editorDidConfigure) {
                _this.props.editorDidConfigure(_this.editor);
            }
        };
        return _this;
    }

    _createClass(CodeMirror, [{
        key: 'componentWillMount',
        value: function componentWillMount() {
            if (this.props.editorWillMount) {
                this.props.editorWillMount();
            }
        }
    }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
            var _this2 = this;

            /* deprecation warnings per 1.0.0 release */
            if (this.props.onValueChange) {
                console.warn('`onValueChange` has been deprecated. Please use `onChange` instead');
            }

            if (this.props.onValueSet) {
                console.warn('`onValueSet` has been deprecated. Please use `onSet` instead');
            }
            /* end deprecation warnings per 1.0.0 release */

            if (this.props.defineMode) {
                if (this.props.defineMode.name && this.props.defineMode.fn) {
                    codemirror.defineMode(this.props.defineMode.name, this.props.defineMode.fn);
                }
            }

            this.editor = codemirror(this.ref);

            CodeMirrorSpellChecker({
                codeMirrorInstance: codemirror
            });

            this.editor.on('beforeChange', function (cm, changeObj) {
                if (_this2.props.onBeforeChange && _this2.hydrated) {
                    _this2.props.onBeforeChange(_this2.editor, changeObj, _this2.onBeforeChangeCb);
                }
            });

            this.editor.on('change', function (cm, metadata) {
                if (_this2.props.onChange && _this2.hydrated) {
                    if (_this2.props.onBeforeChange) {
                        if (_this2.continuePreChange) {
                            _this2.props.onChange(_this2.editor, metadata, _this2.editor.getValue());
                        }
                    } else {
                        _this2.props.onChange(_this2.editor, metadata, _this2.editor.getValue());
                    }
                }
            });

            if (this.props.onCursorActivity) {
                this.editor.on('cursorActivity', function (cm) {
                    _this2.props.onViewportChange(_this2.editor);
                });
            }

            if (this.props.onViewportChange) {
                this.editor.on('viewportChange', function (cm, start, end) {
                    _this2.props.onViewportChange(_this2.editor, start, end);
                });
            }

            if (this.props.onGutterClick) {
                this.editor.on('gutterClick', function (cm, lineNumber, event) {
                    _this2.props.onGutterClick(_this2.editor, lineNumber, event);
                });
            }

            if (this.props.onFocus) {
                this.editor.on('focus', function (cm, event) {
                    _this2.props.onFocus(_this2.editor, event);
                });
            }

            if (this.props.onBlur) {
                this.editor.on('blur', function (cm, event) {
                    _this2.props.onBlur(_this2.editor, event);
                });
            }

            if (this.props.onUpdate) {
                this.editor.on('update', function (cm, event) {
                    _this2.props.onUpdate(_this2.editor, event);
                });
            }

            if (this.props.onKeyDown) {
                this.editor.on('keydown', function (cm, event) {
                    _this2.props.onKeyDown(_this2.editor, event);
                });
            }

            if (this.props.onKeyUp) {
                this.editor.on('keyup', function (cm, event) {
                    _this2.props.onKeyUp(_this2.editor, event);
                });
            }

            if (this.props.onKeyPress) {
                this.editor.on('keypress', function (cm, event) {
                    _this2.props.onKeyPress(_this2.editor, event);
                });
            }

            if (this.props.onDragEnter) {
                this.editor.on('dragenter', function (cm, event) {
                    _this2.props.onDragEnter(_this2.editor, event);
                });
            }

            if (this.props.onDragOver) {
                this.editor.on('dragover', function (cm, event) {
                    _this2.props.onDragOver(_this2.editor, event);
                });
            }

            if (this.props.onDrop) {
                this.editor.on('drop', function (cm, event) {
                    _this2.props.onDrop(_this2.editor, event);
                });
            }

            if (this.props.onSelection) {
                this.editor.on('beforeSelectionChange', function (cm, meta) {
                    _this2.props.onSelection(_this2.editor, meta.ranges);
                });
            }

            if (this.props.onScroll) {
                this.editor.on('scroll', function (cm) {
                    var meta = _this2.editor.getScrollInfo();

                    _this2.props.onScroll(_this2.editor, {
                        x: meta.left,
                        y: meta.top
                    });
                });
            }

            if (this.props.onCursor) {
                this.editor.on('cursorActivity', function (cm) {
                    var meta = _this2.editor.getCursor();

                    _this2.props.onCursor(_this2.editor, {
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
    }, {
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(nextProps) {
            if (this.props.value !== nextProps.value) {
                this.hydrated = false;
            }

            if (!this.props.resetCursorOnSet) {
                this.cursorPos = this.editor.getCursor();
            }

            this.hydrate(nextProps);

            if (!this.props.resetCursorOnSet) {
                !this.props.autoScrollCursorOnSet && this.props.autoScrollCursorOnSet !== undefined ? this.editor.setCursor(this.cursorPos, null, { scroll: false }) : this.editor.setCursor(this.cursorPos);
            }
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            if (this.props.editorWillUnmount) {
                this.props.editorWillUnmount(codemirror);
            }
        }
    }, {
        key: 'hydrate',
        value: function hydrate(props) {
            var _this3 = this;

            Object.keys(props.options || {}).forEach(function (key) {
                return _this3.editor.setOption(key, props.options[key]);
            });

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
    }, {
        key: 'render',
        value: function render() {
            var _this4 = this;

            var className = this.props.className ? 'react-codemirror2 ' + this.props.className : 'react-codemirror2';

            return _react2.default.createElement('div', { className: className, ref: function ref(self) {
                    return _this4.ref = self;
                } });
        }
    }]);

    return CodeMirror;
}(_react2.default.Component);

exports.default = CodeMirror;