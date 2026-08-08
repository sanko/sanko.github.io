// Convert markdown-it-footnote output into Tufte-style sidenotes.
//
// Each footnote reference becomes the Tufte-CSS markup pattern:
//   <label for="sn-N" class="margin-toggle sidenote-number"></label>
//   <input type="checkbox" id="sn-N" class="margin-toggle"/>
//   <span class="sidenote">…note content…</span>
//
// The end-of-document footnote block rendered by markdown-it-footnote is
// removed entirely; the note body is inlined at the reference point so the
// float-based .sidenote styling works.
'use strict';

module.exports = function markdownItSidenote(md) {
    md.core.ruler.after('footnote_tail', 'footnotes_to_sidenotes', function footnotesToSidenotes(state) {
        const list = state.env.footnotes && state.env.footnotes.list;
        if (!list || list.length === 0) return;

        function htmlToken(content) {
            const t = new state.Token('html_inline', '', 0);
            t.content = content;
            return t;
        }

        const content = []; // footnote id -> inline child tokens

        // Collect each footnote body and drop the footnote block at the end
        // of the token stream.
        const kept = [];
        let i = 0;
        while (i < state.tokens.length) {
            const tok = state.tokens[i];
            if (tok.type === 'footnote_block_open') {
                i += 1;
                while (i < state.tokens.length && state.tokens[i].type !== 'footnote_block_close') {
                    const t = state.tokens[i];
                    if (t.type === 'footnote_open') {
                        const id = t.meta.id;
                        const children = [];
                        i += 1;
                        while (i < state.tokens.length && state.tokens[i].type !== 'footnote_close') {
                            const inner = state.tokens[i];
                            if (inner.type === 'inline' && inner.children) {
                                children.push(...inner.children);
                            }
                            i += 1;
                        }
                        content[id] = children;
                    }
                    i += 1;
                }
                i += 1; // skip footnote_block_close
                continue;
            }
            kept.push(tok);
            i += 1;
        }
        state.tokens = kept;

        // Replace each footnote reference with the sidenote markup. Nested
        // references inside note bodies are handled recursively.
        let refCount = 0;
        function replace(children) {
            const out = [];
            for (const child of children) {
                if (child.type === 'footnote_ref') {
                    refCount += 1;
                    const id = 'sn-' + refCount;
                    const body = content[child.meta.id] || [];
                    out.push(htmlToken('<label for="' + id + '" class="margin-toggle sidenote-number"></label>'));
                    out.push(htmlToken('<input type="checkbox" id="' + id + '" class="margin-toggle"/>'));
                    out.push(htmlToken('<span class="sidenote">'));
                    out.push(...replace(body));
                    out.push(htmlToken('</span>'));
                } else {
                    out.push(child);
                }
            }
            return out;
        }

        for (const tok of state.tokens) {
            if (tok.type === 'inline' && tok.children) {
                tok.children = replace(tok.children);
            }
        }
    });
};
